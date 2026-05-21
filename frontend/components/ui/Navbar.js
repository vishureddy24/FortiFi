import WalletDropdown from "./WalletDropdown";

export default function Navbar() {

  return (
    <>
      {/* Navbar */}
      <nav className="md:flex-row md:flex-nowrap md:justify-start flex items-center px-4 py-2 border bg-gray-700 border-gray-500">
        <div className="w-full mx-auto items-center flex justify-between md:flex-nowrap flex-wrap md:px-10 px-4">
          {/* Brand */}
          <div className="w-full flex items-center justify-between">
            <div className="flex gap-4">
              <a
                className="text-white text-sm hidden lg:inline-block font-semibold"
                href="/"
              >
                Dashboard
              </a>
              <a
                className="text-emerald-400 text-sm hidden lg:inline-block font-bold flex items-center"
                href="/portfolio"
              >
                <span className="mr-1">📊</span> Portfolio
              </a>
              <a
                className="text-red-400 text-sm hidden lg:inline-block font-bold flex items-center"
                href="/security"
              >
                <span className="mr-1">🛡️</span> Security Control
              </a>
              <a
                className="text-blue-400 text-sm hidden lg:inline-block font-bold flex items-center"
                href="/enterprise"
              >
                <span className="mr-1">🏢</span> Enterprise
              </a>
              <a
                className="text-purple-400 text-sm hidden lg:inline-block font-bold flex items-center"
                href="/saas"
              >
                <span className="mr-1">🔌</span> SaaS API
              </a>
            </div>
            <div className="flex items-center">
               <WalletDropdown />
            </div>
          </div>
          {/* Form */}

          {/* User */}
        </div>
      </nav>
      {/* End Navbar */}
    </>
  );
}
