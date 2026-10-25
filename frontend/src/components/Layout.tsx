import { useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { invitesApi } from '../api';
import { useRequest } from '../api/useRequest';
import { useAuth } from '../auth/AuthContext';
import { pt } from '../i18n/pt';
import { Avatar } from './Avatar';
import { Menu, MenuItem } from './Menu';
import { UsageBars } from './UsageBars';

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-emphasis text-sm font-bold text-on-emphasis"
    >
      M
    </span>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium hover:bg-control-hover ${
    isActive ? 'bg-control-hover text-fg' : 'text-muted'
  }`;

function InviteCount() {
  const load = useCallback(() => invitesApi.mine(), []);
  const { data } = useRequest(load);
  if (!data || data.length === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-accent-emphasis px-1.5 text-xs text-on-emphasis">
      {data.length}
    </span>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-canvas">
        <div className="flex items-center gap-4 px-4 py-3 md:px-6">
          <NavLink
            to="/"
            className="flex items-center gap-2 font-semibold text-fg no-underline"
          >
            <BrandMark />
            <span className="hidden sm:inline">{pt.appName}</span>
          </NavLink>
          <nav className="flex flex-1 items-center gap-1">
            <NavLink to="/" end className={navClass}>
              {pt.nav.projects}
            </NavLink>
            <NavLink to="/invites" className={navClass}>
              {pt.nav.invites}
              <InviteCount />
            </NavLink>
            <NavLink to="/skills" className={navClass}>
              {pt.nav.skills}
            </NavLink>
            {user?.is_superadmin && (
              <NavLink to="/admin" className={navClass}>
                {pt.nav.admin}
              </NavLink>
            )}
          </nav>
          {user && <UsageBars />}
          {user && (
            <Menu
              label={pt.nav.userMenu}
              trigger={<Avatar name={user.name} size={28} />}
            >
              {(close) => (
                <>
                  <p className="border-b border-line-muted px-4 py-2 text-xs text-muted">
                    <span className="block font-semibold text-fg">
                      {user.name}
                    </span>
                    {user.email}
                  </p>
                  <MenuItem
                    onClick={() => {
                      close();
                      navigate('/settings');
                    }}
                  >
                    {pt.nav.settings}
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close();
                      void logout();
                    }}
                  >
                    {pt.nav.signOut}
                  </MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      </header>
      <main className="px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
