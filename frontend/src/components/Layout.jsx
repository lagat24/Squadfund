import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Icon, Logo } from "./ui.jsx";

function IdentityMenu() {
  const { user, identities, switchTo, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef(null);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user) {
    return <Link to="/start" className="btn btn-secondary btn-sm">Enter your name</Link>;
  }
  const others = identities.filter((i) => i.id !== user.id);
  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-secondary btn-sm" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <Icon name="user-circle" className="text-base" />
        <span className="max-w-[9rem] truncate">{user.display_name}</span>
        <Icon name="angle-down" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-md border border-line bg-white p-2 text-sm">
          {others.length > 0 && <p className="px-2 pb-1 pt-1 text-xs text-muted">Switch member on this device</p>}
          {others.map((i) => (
            <button key={i.id} role="menuitem" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-ink-50"
              onClick={async () => { try { await switchTo(i); nav("/groups"); } catch (e) { setErr(e.message); } }}>
              <Icon name="user-friends" className="text-ink-500" /> {i.name}
            </button>
          ))}
          {err && <p className="px-2 py-1 text-[13px] text-danger">{err}</p>}
          <Link role="menuitem" to="/start" className="flex items-center gap-2 rounded px-2 py-1.5 no-underline hover:bg-ink-50" onClick={async () => { await signOut(); }}>
            <Icon name="plus-circle" className="text-ink-500" /> Join as someone else
          </Link>
          <button role="menuitem" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-ink-50"
            onClick={async () => { await signOut(); nav("/"); }}>
            <Icon name="sign-out-alt" className="text-ink-500" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const link = ({ isActive }) => `text-sm font-medium no-underline ${isActive ? "text-ink-900" : "text-muted hover:text-ink-900"}`;
  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-ink-900 px-4 py-1.5 text-center text-xs text-ink-100">
        Prototype: payments use PayPal Sandbox test money, balances are a simulated ledger, and SquadFund does not hold funds.
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 no-underline">
              <Logo />
              <span className="font-display text-lg font-semibold text-ink-900">SquadFund</span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex" aria-label="Main">
              {user && <NavLink to="/groups" className={link}>Your groups</NavLink>}
              <NavLink to="/join" className={link}>Join with a code</NavLink>
              <NavLink to="/start" end className={link}>Start a group</NavLink>
            </nav>
          </div>
          <IdentityMenu />
        </div>
        <nav className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 sm:hidden" aria-label="Main">
          {user && <NavLink to="/groups" className={link}>Your groups</NavLink>}
          <NavLink to="/join" className={link}>Join with a code</NavLink>
          <NavLink to="/start" end className={link}>Start a group</NavLink>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 text-[13px] text-muted">
          <p>SquadFund is a hackathon prototype. Supplier offers are simulated and not real quotes. PayPal payments are Sandbox test transactions. AI drafts are suggestions; people decide.</p>
        </div>
      </footer>
    </div>
  );
}
