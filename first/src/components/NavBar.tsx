import { NavLink } from 'react-router-dom';

export default function NavBar() {
  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="px-4 py-3">
        <div className="flex items-center justify-center">         
          <div className="flex gap-12">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-6 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              Gallery
            </NavLink>
            <NavLink
              to="/editor/new"
              className={({ isActive }) =>
                `px-6 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              Create
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}