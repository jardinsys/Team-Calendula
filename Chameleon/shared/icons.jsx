import React from 'react'
import {
  Home, Zap, Users, Layers, Folder, FileText, Heart, Settings, LogOut,
  Drama, Shuffle, Pencil, Trash2, Pin, Plus, ArrowLeft, ChevronRight,
  BatteryFull, BatteryMedium, BatteryLow, TriangleAlert, CircleCheck,
  CircleX, Moon, User, Waves, Package, BarChart3, RefreshCw, Rocket,
  Star, Diamond, Circle, Globe, Inbox, NotepadText, GripVertical,
  Wrench, Bell, Lock, Download, Brain, Link, Search, Save,
  ClipboardList, Sparkles, Menu, ChevronDown, ChevronUp,
  LayoutGrid, PawPrint, Loader2
} from 'lucide-react'

export const Icons = {
  home: Home,
  zap: Zap,
  users: Users,
  layers: Layers,
  folder: Folder,
  fileText: FileText,
  notepadText: NotepadText,
  heart: Heart,
  settings: Settings,
  logOut: LogOut,
  drama: Drama,
  shuffle: Shuffle,
  pencil: Pencil,
  trash: Trash2,
  pin: Pin,
  plus: Plus,
  arrowLeft: ArrowLeft,
  chevronRight: ChevronRight,
  batteryFull: BatteryFull,
  batteryMedium: BatteryMedium,
  batteryLow: BatteryLow,
  alert: TriangleAlert,
  check: CircleCheck,
  x: CircleX,
  moon: Moon,
  user: User,
  waves: Waves,
  package: Package,
  barChart: BarChart3,
  refresh: RefreshCw,
  rocket: Rocket,
  star: Star,
  diamond: Diamond,
  circle: Circle,
  globe: Globe,
  inbox: Inbox,
  gripVertical: GripVertical,
  wrench: Wrench,
  bell: Bell,
  lock: Lock,
  download: Download,
  brain: Brain,
  link: Link,
  search: Search,
  save: Save,
  clipboardList: ClipboardList,
  sparkles: Sparkles,
  menu: Menu,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  layoutGrid: LayoutGrid,
  pawPrint: PawPrint,
  loader: Loader2,
  // Custom ampersand for SimplyPlural brand
  ampersand: ({ size = 16, color = 'currentColor', className = '', style, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide-icon ${className}`}
      style={style}
      {...props}
    >
      <path d="M17.5 12c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.85 0 3.58.63 4.95 1.69" />
      <path d="M12.5 12c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5c1.17 0 2.24.41 3.1 1.09" />
      <path d="M17.5 12l4.5 4.5" />
    </svg>
  )
}

export function Icon({ name, size = 16, color, className = '', style, ...props }) {
  const LucideIcon = Icons[name]
  if (!LucideIcon) return null
  return (
    <LucideIcon
      size={size}
      color={color}
      className={`lucide-icon ${className}`}
      style={style}
      {...props}
    />
  )
}

export function getBatteryIcon(battery) {
  if (battery == null) return null
  if (battery >= 70) return { name: 'batteryFull', color: '#86efac' }
  if (battery >= 30) return { name: 'batteryMedium', color: '#fdba74' }
  return { name: 'batteryLow', color: '#fca5a5' }
}
