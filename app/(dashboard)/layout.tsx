export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar placeholder — wired up in commit #16 */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
