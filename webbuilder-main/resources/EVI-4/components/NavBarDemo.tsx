import { NavBar } from "@/components/ui/tubelight-navbar"
import { Home, User, FolderOpen, FileText } from 'lucide-react';

export function NavBarDemo() {
  const navItems = [
    { name: 'Home', url: '#', icon: Home },
    { name: 'About', url: '#', icon: User },
    { name: 'Projects', url: '#', icon: FolderOpen },
    { name: 'Resume', url: '#', icon: FileText }
  ]

  return <NavBar items={navItems} />
}