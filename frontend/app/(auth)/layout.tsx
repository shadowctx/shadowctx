export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="8" r="2" fill="white" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-gray-100 tracking-tight">
              ShadowCTX
            </span>
          </div>
          <p className="text-sm text-gray-500">Engineering context, captured.</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
          {children}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          &copy; {new Date().getFullYear()} ShadowCTX
        </p>
      </div>
    </div>
  );
}
