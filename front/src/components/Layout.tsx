import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';

function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-x-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
