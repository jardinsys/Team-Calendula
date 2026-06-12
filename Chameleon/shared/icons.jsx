import React from 'react'
import {
  Home, Zap, Users, Layers, Folder, FileText, Heart, Settings, LogOut,
  Drama, Shuffle, Pencil, Trash2, Pin, Plus, ArrowLeft, ChevronRight,
  BatteryFull, BatteryMedium, BatteryLow, TriangleAlert, CircleCheck,
  CircleX, Moon, User, Waves, Package, BarChart3, RefreshCw, Rocket,
  Star, Diamond, Circle, Globe, Inbox, NotepadText, GripVertical
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
  gripVertical: GripVertical
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
