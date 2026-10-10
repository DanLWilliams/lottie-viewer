import { useCallback, useRef, useState } from 'react'
import { LottieCarousel } from './components/LottieCarousel'
import { LottieColorEditor } from './components/LottieColorEditor'
import type { LottieAnimationData, LottieFile } from './types'
import { formatFileSize, getFrameCount, readLottieFile } from './utils/lottie'
import './App.css'

function createId(): string {
  return crypto.randomUUID()
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<LottieFile[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [loadErrors, setLoadErrors] = useState<string[]>([])
  const [editMode, setEditMode] = useState(false)

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const selected = Array.from(fileList).filter(
      (f) =>
        f.name.endsWith('.json') ||
        f.type === 'application/json' ||
        f.type === '',
    )

    if (selected.length === 0) {
      setLoadErrors(['Please choose .json Lottie files.'])
      return
    }

    const errors: string[] = []
    const loaded: LottieFile[] = []

    for (const file of selected) {
      try {
        const data = structuredClone(await readLottieFile(file))
        loaded.push({
          id: createId(),
          name: file.name,
          size: file.size,
          originalData: structuredClone(data),
          data,
          frameCount: getFrameCount(data),
          dataVersion: 0,
          isDirty: false,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid file'
        errors.push(`${file.name}: ${message}`)
      }
    }

    if (loaded.length > 0) {
      setFiles((prev) => [...prev, ...loaded])
    }

    setLoadErrors(errors)
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      void addFiles(e.target.files)
      e.target.value = ''
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) {
      void addFiles(e.dataTransfer.files)
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      if (idx === -1) return prev
      const next = prev.filter((f) => f.id !== id)
      setActiveIndex((current) => {
        if (next.length === 0) return 0
        if (current >= next.length) return next.length - 1
        if (current > idx) return current - 1
        return current
      })
      return next
    })
  }

  const clearAll = () => {
    setFiles([])
    setActiveIndex(0)
    setLoadErrors([])
    setEditMode(false)
  }

  const active = files[activeIndex]

  const updateFileData = useCallback(
    (fileId: string, next: LottieAnimationData) => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === fileId
            ? {
                ...file,
                data: next,
                dataVersion: file.dataVersion + 1,
                isDirty: true,
              }
            : file,
        ),
      )
    },
    [],
  )

  const resetFileData = useCallback((fileId: string) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? {
              ...file,
              data: structuredClone(file.originalData),
              dataVersion: file.dataVersion + 1,
              isDirty: false,
            }
          : file,
      ),
    )
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Free Lottie Editor</h1>
        <p className="app-tagline">
          Upload Lottie JSON for free—preview animations, edit colors, and
          download updated files. No account required; everything runs in your
          browser.
        </p>
      </header>

      <main className={`layout${editMode ? ' layout--editing' : ''}`}>
        {!editMode && (
        <section className="panel panel--input">
          <h2 className="panel-label">Input</h2>
          <h3 className="panel-title">Upload Lottie files</h3>
          <p className="panel-desc">
            Choose one or more animation JSON files from your device, or drag
            them onto the drop zone. Each valid file is added to the preview
            carousel.
          </p>

          <div
            className={`dropzone${dragOver ? ' dropzone--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <span className="dropzone-label">Drag and drop</span>
            <p>Drop one or more Lottie .json files here</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              multiple
              hidden
              onChange={onInputChange}
            />
          </div>

          {loadErrors.length > 0 && (
            <ul className="errors" aria-live="polite">
              {loadErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}

          {files.length > 0 && (
            <div className="file-list-wrap">
              <div className="file-list-header">
                <span>{files.length} animation{files.length === 1 ? '' : 's'}</span>
                <button type="button" className="btn btn--ghost" onClick={clearAll}>
                  Clear all
                </button>
              </div>
              <ul className="file-list">
                {files.map((file, i) => (
                  <li
                    key={file.id}
                    className={`file-item${i === activeIndex ? ' file-item--active' : ''}`}
                  >
                    <button
                      type="button"
                      className="file-item-main"
                      onClick={() => setActiveIndex(i)}
                    >
                      <span className="file-item-name">{file.name}</span>
                      <span className="file-item-meta">
                        {formatFileSize(file.size)}
                        {file.frameCount != null && ` · ${file.frameCount} frames`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="file-item-remove"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(file.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {active && (
            <dl className="meta-grid">
              <div>
                <dt>Source</dt>
                <dd>{active.name}</dd>
              </div>
              <div>
                <dt>File size</dt>
                <dd>{formatFileSize(active.size)}</dd>
              </div>
              <div>
                <dt>Frame count</dt>
                <dd>{active.frameCount ?? '—'}</dd>
              </div>
            </dl>
          )}
        </section>
        )}

        <section className={`panel panel--preview${editMode ? ' panel--preview-editing' : ''}`}>
          <div className="preview-header">
            <h2 className="panel-label">Preview</h2>
            <div className="preview-header-actions">
              {active?.isDirty && (
                <span className="badge badge--edited">Edited</span>
              )}
              {files.length > 0 && (
                <span className="badge badge--ok">Rendered</span>
              )}
              {active && (
                <button
                  type="button"
                  className={`btn btn--${editMode ? 'ghost' : 'primary'}`}
                  onClick={() => setEditMode((on) => !on)}
                >
                  {editMode ? 'Done editing' : 'Edit colors'}
                </button>
              )}
            </div>
          </div>
          <h3 className="panel-title">
            {editMode && active ? active.name : 'Lottie animation'}
          </h3>

          <div
            className={`preview-workspace${editMode ? ' preview-workspace--editing' : ''}`}
          >
            <div className="preview-frame">
              <LottieCarousel
                files={files}
                index={activeIndex}
                onIndexChange={setActiveIndex}
                compact={editMode}
              />
            </div>

            {editMode && active && (
              <aside className="edit-panel" aria-label="Color editor">
                <h4 className="edit-panel-title">Color editor</h4>
                <LottieColorEditor
                  file={active}
                  onChange={updateFileData}
                  onReset={resetFileData}
                />
              </aside>
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <h2 className="app-footer-title">About Free Lottie Editor</h2>
        <p className="app-footer-lead">
          A free online Lottie JSON editor for designers and developers. Upload
          Bodymovin / Lottie animation files, preview them in a carousel, tweak
          fill and stroke colors from a shared palette or by layer, then export
          edited JSON—without installing software or creating an account.
        </p>
        <ul className="app-footer-features">
          <li>Multi-file upload and drag-and-drop</li>
          <li>Live Lottie preview with carousel navigation</li>
          <li>Palette, global, and layer-based color editing</li>
          <li>Download edited Lottie JSON for use in apps and on the web</li>
          <li>Client-side processing; files are not uploaded for editing</li>
        </ul>
      </footer>
    </div>
  )
}

export default App
