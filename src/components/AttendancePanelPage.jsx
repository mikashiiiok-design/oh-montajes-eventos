import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Save, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../utils/api.js'
import { attendanceAccessRoles, attendanceWorkerRoles, getRoleInfo } from '../../shared/roles.js'
import './AttendancePanelPage.css'

const attendanceOptions = [
  { value: 'present', label: 'Asistencia normal' },
  { value: 'late', label: 'Asistencia tardía' },
  { value: 'late_justified', label: 'Asistencia tardía justificada' },
  { value: 'absent', label: 'Inasistencia' },
]

const accessRoles = new Set(attendanceAccessRoles)
const workerRoles = new Set(attendanceWorkerRoles)

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function isValidDateInputValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  return toDateInputValue(parsed) === value
}

function AttendancePanelPage() {
  const [sessionAccount, setSessionAccount] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))
  const [queryDate, setQueryDate] = useState(toDateInputValue(new Date()))
  const [workers, setWorkers] = useState([])
  const [draft, setDraft] = useState({})
  const [savedDates, setSavedDates] = useState(new Set())
  const [queryRecords, setQueryRecords] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [queryError, setQueryError] = useState('')

  useEffect(() => {
    const previousTitle = document.title
    const previousRobots = document.querySelector('meta[name="robots"]')
    const previousRobotsContent = previousRobots?.content

    document.title = 'Lista de asistencia | OH Montajes y Eventos'
    if (previousRobots) {
      previousRobots.content = 'noindex, nofollow'
    } else {
      const robots = document.createElement('meta')
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.append(robots)
    }

    return () => {
      document.title = previousTitle
      if (previousRobots) {
        previousRobots.content = previousRobotsContent
      } else {
        document.querySelector('meta[name="robots"]')?.remove()
      }
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function refreshSession() {
      try {
        const { account } = await apiRequest('/api/auth/me')
        if (!isActive) return
        setSessionAccount(account)
      } catch {
        if (isActive) setSessionAccount(null)
      } finally {
        if (isActive) setIsCheckingSession(false)
      }
    }

    refreshSession()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (isCheckingSession || !sessionAccount || !accessRoles.has(sessionAccount.role)) {
      return undefined
    }

    let isActive = true

    async function loadAttendance() {
      try {
        const [workersResult, attendanceResult] = await Promise.all([
          apiRequest('/api/auth/attendance/workers'),
          apiRequest(`/api/auth/attendance?date=${selectedDate}`),
        ])

        if (!isActive) return

        const nextWorkers = Array.isArray(workersResult.workers)
          ? workersResult.workers.filter((worker) => attendanceWorkerRoles.includes(worker.role))
          : []
        const nextMap = Object.fromEntries((attendanceResult.records ?? []).map((record) => [String(record.accountId), record]))
        const dateHasSavedRecords = (attendanceResult.records ?? []).length > 0

        setWorkers(nextWorkers)
        setDraft(Object.fromEntries(
          nextWorkers.map((worker) => {
            const existing = nextMap[String(worker.id)]
            return [String(worker.id), existing ? existing.status : '']
          }),
        ))
        setSavedDates((current) => {
          const next = new Set(current)
          if (dateHasSavedRecords) next.add(selectedDate)
          else next.delete(selectedDate)
          return next
        })
        setHasUnsavedChanges(false)
        setError('')
      } catch (requestError) {
        if (isActive) {
          setError(requestError.message || 'No se pudo cargar la asistencia.')
        }
      }
    }

    loadAttendance()
    return () => { isActive = false }
  }, [isCheckingSession, selectedDate, sessionAccount])

  useEffect(() => {
    let isActive = true

    async function loadQueryRecords() {
      try {
        const result = await apiRequest(`/api/auth/attendance?date=${queryDate}`)
        if (!isActive) return
        setQueryRecords(Array.isArray(result.records) ? result.records : [])
        setQueryError('')
      } catch (requestError) {
        if (isActive) {
          setQueryRecords([])
          setQueryError(requestError.message || 'No se pudo consultar la asistencia.')
        }
      }
    }

    loadQueryRecords()
    return () => { isActive = false }
  }, [queryDate])

  const visibleWorkers = useMemo(
    () => workers.filter((worker) => workerRoles.has(worker.role)),
    [workers],
  )

  async function handleSave() {
    if (!sessionAccount || !accessRoles.has(sessionAccount.role)) {
      window.location.replace('/404')
      return
    }

    const missingSelection = visibleWorkers.some((worker) => !draft[String(worker.id)])
    if (missingSelection) {
      setError('Debes seleccionar una opción para cada trabajador antes de guardar.')
      return
    }

    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const entries = visibleWorkers.map((worker) => ({
        accountId: worker.id,
        status: draft[String(worker.id)],
      }))

      await apiRequest('/api/auth/attendance', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate, entries }),
      })

      setSavedDates((current) => new Set(current).add(selectedDate))
      setHasUnsavedChanges(false)
      setNotice('El registro de asistencia quedó guardado correctamente.')
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar la asistencia.')
    } finally {
      setIsSaving(false)
    }
  }

  const isAccessBlocked = !isCheckingSession && (!sessionAccount || !accessRoles.has(sessionAccount.role))
  const isDateLocked = savedDates.has(selectedDate)
  const hasIncompleteSelection = visibleWorkers.some((worker) => !draft[String(worker.id)])

  if (isCheckingSession) {
    return (
      <main className="attendance-panel-page">
        <div className="attendance-state" role="status">Comprobando acceso…</div>
      </main>
    )
  }

  if (isAccessBlocked) {
    return (
      <main className="attendance-panel-page">
        <div className="attendance-state" role="alert">
          <ShieldCheck size={28} />
          <h1>Acceso restringido</h1>
          <p>Esta sección solo está disponible para el Dueño, el Jefe de Bodega, el Contador y la Secretaria.</p>
          <a href="/cuenta">Volver a mi cuenta</a>
        </div>
      </main>
    )
  }

  return (
    <main className="attendance-panel-page">
      <header className="attendance-panel-topbar">
        <a href="/cuenta" className="attendance-panel-back"><ArrowLeft size={16} /> Cuenta</a>
        <span className="attendance-panel-brand">OH / ASISTENCIA</span>
      </header>

      <div className="attendance-panel-shell">
        <section className="attendance-panel-heading">
          <div>
            <p className="attendance-panel-eyebrow"><span>CONTROL / 02</span> Registro diario</p>
            <h1>Lista de asistencia</h1>
          </div>
        </section>

        <section className="attendance-panel-summary">
          <div className="attendance-panel-summary-item">
            <span className="attendance-summary-label">Fecha actual</span>
            <strong>{formatDayLabel(selectedDate)}</strong>
          </div>
          <div className="attendance-panel-summary-item">
            <span className="attendance-summary-label">Personal activo</span>
            <strong>{visibleWorkers.length} colaboradores</strong>
          </div>
        </section>

        {notice && <p className="attendance-panel-notice" role="status">{notice}</p>}
        {error && <p className="attendance-panel-error" role="alert">{error}</p>}

        <section className="attendance-panel-card" aria-label="Listado de asistencia por trabajador">
          <div className="attendance-panel-table-header">
            <span>Trabajador</span>
            <span>Rol</span>
            <span>Asistencia</span>
          </div>

          {visibleWorkers.length === 0 ? (
            <p className="attendance-panel-empty">No hay personal disponible para esta fecha.</p>
          ) : (
            <div className="attendance-panel-list">
              {visibleWorkers.map((worker) => (
                <div key={worker.id} className="attendance-panel-row">
                  <div className="attendance-worker-meta">
                    <span className="attendance-worker-name">{worker.name}</span>
                    <small className="attendance-worker-email">{worker.email}</small>
                  </div>
                  <span className="attendance-role-pill" data-role={worker.role}>{getRoleInfo(worker.role).label}</span>
                  <label className="attendance-status-wrap">
                    <select
                      value={draft[String(worker.id)] ?? ''}
                      disabled={isDateLocked || isSaving}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setDraft((current) => ({ ...current, [String(worker.id)]: nextValue }))
                        setHasUnsavedChanges(true)
                      }}
                      aria-label={`Estado de asistencia para ${worker.name}`}
                    >
                      <option value="">Selecciona una opción</option>
                      {attendanceOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="attendance-panel-actions">
            <button
              type="button"
              onClick={handleSave}
              className="attendance-panel-save"
              disabled={isSaving || isDateLocked || !hasUnsavedChanges || hasIncompleteSelection || visibleWorkers.length === 0}
            >
              {isSaving ? 'Guardando…' : 'Guardar registro'}
              {!isSaving && <Save size={15} />}
            </button>
          </div>
        </section>

        <section className="attendance-panel-card attendance-panel-card--query" aria-label="Consulta de registros de asistencia">
          <div className="attendance-query-header">
            <div>
              <p className="attendance-query-kicker">Consulta de registros</p>
              <h2>Resumen de asistencia</h2>
            </div>

            <label className="attendance-date-picker attendance-date-picker--compact" aria-label="Consultar asistencia por fecha">
              <CalendarDays size={15} />
              <input
                type="date"
                value={queryDate}
                max={toDateInputValue(new Date())}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (!isValidDateInputValue(nextValue)) {
                    return
                  }
                  setQueryDate(nextValue)
                }}
              />
            </label>
          </div>

          {queryError && <p className="attendance-panel-error" role="alert">{queryError}</p>}

          {queryRecords.length === 0 ? (
            <div className="attendance-query-empty">
              <span className="attendance-query-empty-icon">!</span>
              <p>No hay registro de asistencia guardado para ese día.</p>
            </div>
          ) : (
            <div className="attendance-query-results">
              <div className="attendance-query-summary">
                <span className="attendance-query-date-label">Fecha consultada</span>
                <strong>{formatDayLabel(queryDate)}</strong>
              </div>

              <div className="attendance-query-list">
                {queryRecords.map((record) => {
                  const roleInfo = getRoleInfo(record.role)
                  const recordStatus = attendanceOptions.find((option) => option.value === record.status)?.label ?? record.status

                  return (
                    <div key={`${record.accountId}-${record.date ?? queryDate}`} className="attendance-query-item">
                      <div className="attendance-query-meta">
                        <span className="attendance-query-name">{record.name}</span>
                        <small>{record.email ?? roleInfo.label}</small>
                      </div>

                      <span className="attendance-role-pill" data-role={record.role}>{roleInfo.label}</span>

                      <span className={`attendance-status-badge attendance-status-badge--${record.status ?? 'unknown'}`}>
                        {recordStatus}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default AttendancePanelPage
