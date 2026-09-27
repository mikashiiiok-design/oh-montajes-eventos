import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Save, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../utils/api.js'
import { notifyAccountSync, subscribeToAccountSync } from '../utils/accountSync.js'
import './AttendancePanelPage.css'

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const STATUS_OPTIONS = [
  { value: 'present', label: 'Asistencia normal' },
  { value: 'late', label: 'Asistencia tardía' },
  { value: 'late_justified', label: 'Asistencia tardía justificada' },
  { value: 'absent', label: 'Inasistencia' },
]

const attendanceRoles = new Set(['owner', 'accountant', 'warehouse_manager', 'secretary'])

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatHumanDate(value) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date)
}

function AttendancePanelPage() {
  const [sessionAccount, setSessionAccount] = useState(null)
  const [workers, setWorkers] = useState([])
  const [records, setRecords] = useState([])
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()))
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    const previousTitle = document.title
    const previousRobots = document.querySelector('meta[name="robots"]')
    const previousRobotsContent = previousRobots?.content
    document.title = 'Lista de asistencia | OH Montajes y Eventos'
    if (previousRobots) previousRobots.content = 'noindex, nofollow'
    else {
      const robots = document.createElement('meta')
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.append(robots)
    }
    return () => {
      document.title = previousTitle
      if (previousRobots) previousRobots.content = previousRobotsContent
      else document.querySelector('meta[name="robots"]')?.remove()
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function refreshSession() {
      try {
        const { account } = await apiRequest('/api/auth/me')
        if (isActive) setSessionAccount(account)
      } catch {
        if (isActive) setSessionAccount(null)
      } finally {
        if (isActive) setIsCheckingSession(false)
      }
    }

    refreshSession()
    const unsubscribe = subscribeToAccountSync(() => {
      if (isActive) refreshSession()
    })

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionAccount || !attendanceRoles.has(sessionAccount.role)) {
      if (!isCheckingSession) {
        window.location.replace('/404')
      }
      return undefined
    }

    let isActive = true
    setIsLoading(true)
    setError('')
    setNotice('')

    Promise.all([
      apiRequest('/api/auth/attendance/workers'),
      apiRequest(`/api/auth/attendance?date=${selectedDate}`),
    ])
      .then(([workersResult, recordsResult]) => {
        if (!isActive) return
        setWorkers(workersResult.workers || [])
        setRecords(recordsResult.records || [])

        const nextDrafts = {}
        ;(recordsResult.records || []).forEach((record) => {
          nextDrafts[record.accountId] = {
            status: record.status,
            notes: record.notes || '',
            saved: true,
          }
        })
        setDrafts(nextDrafts)
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message || 'No se pudo cargar la asistencia.')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [sessionAccount, selectedDate, isCheckingSession])

  const workersWithDrafts = useMemo(() => {
    return workers.map((worker) => {
      const record = records.find((entry) => String(entry.accountId) === String(worker.id))
      const draft = drafts[worker.id] || { status: record?.status || 'present', notes: record?.notes || '', saved: Boolean(record) }
      return { ...worker, record, draft }
    })
  }, [workers, drafts, records])

  function updateDraft(accountId, field, value) {
    setDrafts((previous) => {
      const current = previous[accountId] || { status: 'present', notes: '', saved: false }
      return {
        ...previous,
        [accountId]: { ...current, [field]: value },
      }
    })
  }

  async function handleSave() {
    const entries = workersWithDrafts
      .filter((worker) => !worker.draft.saved)
      .map((worker) => ({
        accountId: worker.id,
        status: worker.draft.status,
        notes: worker.draft.notes || '',
      }))

    if (entries.length === 0) {
      setNotice('Ya hay un registro guardado para esta fecha.')
      return
    }

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await apiRequest('/api/auth/attendance', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          entries,
        }),
      })

      const nextDrafts = { ...drafts }
      ;(result.records || []).forEach((record) => {
        nextDrafts[record.accountId] = {
          status: record.status,
          notes: record.notes || '',
          saved: true,
        }
      })
      setDrafts(nextDrafts)
      setNotice('El registro de asistencia quedó guardado correctamente.')
      notifyAccountSync()
      const refreshed = await apiRequest(`/api/auth/attendance?date=${selectedDate}`)
      setRecords(refreshed.records || [])
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar la asistencia.')
    } finally {
      setIsSaving(false)
    }
  }

  const hasUnsavedRows = workersWithDrafts.some((worker) => !worker.draft.saved)

  return (
    <main className="attendance-panel-page">
      <header className="attendance-panel-topbar">
        <a href="/cuenta" className="attendance-panel-back"><ArrowLeft size={16} /> Cuenta</a>
        <span className="attendance-panel-brand">OH / ASISTENCIA</span>
      </header>

      {isCheckingSession ? (
        <div className="attendance-panel-loading" role="status">Comprobando acceso…</div>
      ) : !sessionAccount ? (
        <section className="attendance-panel-state">
          <ShieldCheck size={24} />
          <h1>Inicia sesión para continuar</h1>
          <p>Este panel solo está disponible para los roles autorizados.</p>
          <a href="/cuenta">Volver</a>
        </section>
      ) : !attendanceRoles.has(sessionAccount.role) ? (
        <section className="attendance-panel-state" role="alert">
          <ShieldCheck size={24} />
          <h1>Acceso restringido</h1>
          <p>La asistencia solo está disponible para Dueño, Jefe de Bodega, Contador y Secretaría.</p>
          <a href="/cuenta">Volver a mi cuenta</a>
        </section>
      ) : (
        <div className="attendance-panel-shell">
          <section className="attendance-panel-heading">
            <div>
              <p className="attendance-panel-eyebrow"><span>CONTROL / 02</span> Registro diario</p>
              <h1>Lista de asistencia</h1>
            </div>
            <label className="attendance-date-picker" aria-label="Seleccionar fecha de asistencia">
              <CalendarDays size={16} aria-hidden="true" />
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </section>

          <section className="attendance-panel-summary" aria-label="Resumen de asistencia">
            <div className="attendance-panel-summary-item">
              <span className="attendance-summary-label">Fecha actual</span>
              <strong>{formatHumanDate(selectedDate)}</strong>
            </div>
            <div className="attendance-panel-summary-item">
              <span className="attendance-summary-label">Personal activo</span>
              <strong>{workersWithDrafts.length} colaboradores</strong>
            </div>
          </section>

          {error && <p className="attendance-panel-error" role="alert">{error}</p>}
          {notice && <p className="attendance-panel-notice" role="status">{notice}</p>}

          <section className="attendance-panel-card" aria-label="Listado de asistencia por trabajador">
            <div className="attendance-panel-table-header">
              <span>Trabajador</span>
              <span>Rol</span>
              <span>Asistencia</span>
            </div>

            {isLoading ? (
              <p className="attendance-panel-empty">Cargando asistencia…</p>
            ) : workersWithDrafts.length === 0 ? (
              <p className="attendance-panel-empty">No hay personal disponible para esta fecha.</p>
            ) : (
              workersWithDrafts.map((worker) => {
                const currentDraft = worker.draft || { status: 'present', notes: '', saved: false }
                const isLocked = Boolean(currentDraft.saved)
                return (
                  <div key={worker.id} className="attendance-panel-row">
                    <div className="attendance-worker-meta">
                      <span className="attendance-worker-name">{worker.name}</span>
                      <span className="attendance-worker-email">{worker.email}</span>
                    </div>
                    <div className="attendance-role-pill">
                      {worker.role}
                    </div>
                    <div className="attendance-status-wrap">
                      <select
                        value={currentDraft.status}
                        onChange={(event) => updateDraft(worker.id, 'status', event.target.value)}
                        disabled={isLocked}
                        aria-label={`Estado de asistencia para ${worker.name}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                      {isLocked && <small>Registro enviado</small>}
                    </div>
                  </div>
                )
              })
            )}

            <div className="attendance-panel-actions">
              <button type="button" className="attendance-panel-save" onClick={handleSave} disabled={isSaving || isLoading || !workersWithDrafts.length || !hasUnsavedRows}>
                {isSaving ? 'Guardando…' : 'Guardar registro'}
                <Save size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default AttendancePanelPage
