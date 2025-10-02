import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock4,
  ExternalLink,
  Filter,
  MailPlus,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { getCurrentCongressDay } from '../utils/date'
import { getCurrentCongressDay } from '../utils/date'

import { GameTitle } from '../components/GameTitle'
import {
  getClientDeviceId,
  isActivityLoggingEnabled,
  logActivity,
  subscribeActivityLogs,
  type ActivityLogRecord,
} from '../services/activity'
import { listActivePlays, summarizeRoomOccupancy, type PlayRecord, type RoomOccupancySummary } from '../services/plays'
import { UserLink } from '../components/UserLink'
