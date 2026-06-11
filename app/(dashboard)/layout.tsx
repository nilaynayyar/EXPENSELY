import Sidebar from "@/components/sidebar";
import Header from "@/components/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background text-on-background">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-[260px] min-h-screen w-full relative pt-16 md:pt-0">
        {/* Top Header */}
        <Header />

        {/* Page Canvas */}
        <div className="flex-1 flex flex-col w-full relative">
          {children}
        </div>
      </div>
    </div>
  );
}
