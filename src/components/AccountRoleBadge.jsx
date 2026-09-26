import { Calculator, ClipboardList, Crown, HardHat, Scale, UserRound, Warehouse } from 'lucide-react'
import { accountRoleById, defaultAccountRole } from '../../shared/roles.js'
import './AccountPage.css'

const roleIcons = {
  crown: Crown,
  scale: Scale,
  calculator: Calculator,
  warehouse: Warehouse,
  clipboard: ClipboardList,
  hard_hat: HardHat,
  user: UserRound,
}

function AccountRoleBadge({ role }) {
  const roleInfo = accountRoleById[role] ?? accountRoleById[defaultAccountRole]
  const RoleIcon = roleIcons[roleInfo.icon]

  return (
    <div className="account-role-group" aria-label={`Rol ${roleInfo.label}, nivel ${roleInfo.level}`}>
      <div className="account-role-heading">
        <span className="account-role-badge" data-role={roleInfo.id}>
          <RoleIcon size={15} strokeWidth={2} aria-hidden="true" />
          {roleInfo.label}
        </span>
        <span className="account-role-level">Nivel {roleInfo.level}</span>
      </div>
      <div className="account-role-tags" aria-label="Etiquetas de áreas">
        {roleInfo.areas.map((area) => <span key={area}>{area}</span>)}
      </div>
    </div>
  )
}

export default AccountRoleBadge
