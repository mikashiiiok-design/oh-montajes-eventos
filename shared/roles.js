export const defaultAccountRole = 'client'

export const accountRoles = [
  {
    id: 'owner',
    label: 'Dueño',
    icon: 'crown',
    level: 7,
    color: '#c34f28',
    areas: ['Administración', 'Chat', 'Mobiliario', 'Pedidos'],
  },
  {
    id: 'lawyer',
    label: 'Abogado',
    icon: 'scale',
    level: 6,
    color: '#326a64',
    areas: ['Legal', 'Contratos', 'Documentación'],
  },
  {
    id: 'accountant',
    label: 'Contador',
    icon: 'calculator',
    level: 5,
    color: '#3567a8',
    areas: ['Finanzas', 'Facturación', 'Reportes'],
  },
  {
    id: 'warehouse_manager',
    label: 'Jefe de Bodega',
    icon: 'warehouse',
    level: 4,
    color: '#71813a',
    areas: ['Inventario', 'Bodega', 'Mobiliario'],
  },
  {
    id: 'secretary',
    label: 'Secretaria',
    icon: 'clipboard',
    level: 3,
    color: '#a26a20',
    areas: ['Atención', 'Agenda', 'Chat'],
  },
  {
    id: 'employee',
    label: 'Empleado',
    icon: 'hard_hat',
    level: 2,
    color: '#73578c',
    areas: ['Operaciones', 'Montaje', 'Bodega'],
  },
  {
    id: 'client',
    label: 'Cliente',
    icon: 'user',
    level: 1,
    color: '#59636c',
    areas: ['Pedidos', 'Cotizaciones', 'Chat'],
  },
]

export const accountRoleIds = accountRoles.map(({ id }) => id)
export const accountRoleById = Object.fromEntries(accountRoles.map((role) => [role.id, role]))

export const attendanceAccessRoles = ['owner', 'accountant', 'warehouse_manager', 'secretary']
export const attendanceWorkerRoles = ['accountant', 'warehouse_manager', 'secretary', 'employee']

export function getRoleInfo(role) {
  return accountRoleById[role] ?? accountRoleById[defaultAccountRole]
}
