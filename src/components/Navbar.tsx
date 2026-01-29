import Link from 'next/link';
import { Code2 } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex-shrink-0 flex items-center group">
              <Code2 className="h-8 w-8 text-blue-600 group-hover:text-blue-700 transition-colors" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                HTML Deployer
              </span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                首页
              </Link>
              <Link
                href="/deploy"
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                部署管理
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
