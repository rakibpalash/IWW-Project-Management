'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Profile, AttendanceSettings, CustomTaskStatus, CustomTaskPriority, CustomRole, StaffSalary } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { AttendanceRulesForm } from './attendance-rules-form'
import { TaskStatusesForm } from './task-statuses-form'
import { TaskPrioritiesForm } from './task-priorities-form'
import { CustomRolesTab } from './custom-roles-tab'
import { PermissionTemplatesTab } from './permission-templates-tab'
import { SalaryManagement } from './salary-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, User, Shield, ExternalLink, ListTodo, Flag, Tag, ShieldCheck, Banknote } from 'lucide-react'
import { PermissionTemplate } from '@/app/actions/permission-templates'

interface SettingsPageProps {
  profile: Profile
  isAdmin: boolean
  attendanceSettings: AttendanceSettings | null
  allStaff: Profile[]
  taskStatuses: CustomTaskStatus[]
  taskPriorities: CustomTaskPriority[]
  customRoles: CustomRole[]
  permissionTemplates: PermissionTemplate[]
  salaries: StaffSalary[]
  defaultTab?: string
}

export function SettingsPage({
  profile,
  isAdmin,
  attendanceSettings,
  allStaff,
  taskStatuses,
  taskPriorities,
  customRoles,
  permissionTemplates,
  salaries,
  defaultTab,
}: SettingsPageProps) {
  const resolvedDefault = defaultTab ?? (isAdmin ? 'attendance' : 'profile')
  const [activeTab, setActiveTab] = useState(resolvedDefault)

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    window.history.replaceState(null, '', `/settings?tab=${tab}`)
  }

  return (
    <div className="page-inner">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account and application settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {isAdmin && (
            <>
              <TabsTrigger value="attendance" className="gap-2">
                <Clock className="h-4 w-4" />
                Attendance Rules
              </TabsTrigger>
              <TabsTrigger value="statuses" className="gap-2">
                <ListTodo className="h-4 w-4" />
                Task Statuses
              </TabsTrigger>
              <TabsTrigger value="priorities" className="gap-2">
                <Flag className="h-4 w-4" />
                Task Priorities
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-2">
                <Tag className="h-4 w-4" />
                Job Roles
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Permission Templates
              </TabsTrigger>
              <TabsTrigger value="salary" className="gap-2">
                <Banknote className="h-4 w-4" />
                Salary
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <>
            <TabsContent value="attendance">
              <AttendanceRulesForm settings={attendanceSettings} />
            </TabsContent>

            <TabsContent value="statuses">
              <TaskStatusesForm initialStatuses={taskStatuses} />
            </TabsContent>

            <TabsContent value="priorities">
              <TaskPrioritiesForm initialPriorities={taskPriorities} />
            </TabsContent>

            <TabsContent value="roles">
              <CustomRolesTab initialRoles={customRoles} />
            </TabsContent>

            <TabsContent value="permissions">
              <PermissionTemplatesTab initialTemplates={permissionTemplates} />
            </TabsContent>

            <TabsContent value="salary">
              <div className="space-y-2">
                <div>
                  <h2 className="text-base font-semibold">Staff Salaries</h2>
                  <p className="text-sm text-muted-foreground">
                    Set monthly salaries for salary-based fine calculation. This data is only visible to Super Admin.
                  </p>
                </div>
                <SalaryManagement
                  allStaff={allStaff}
                  initialSalaries={salaries}
                  settings={attendanceSettings}
                />
              </div>
            </TabsContent>
          </>
        )}

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Profile Settings
              </CardTitle>
              <CardDescription>Update your personal information and avatar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">{profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/settings/profile">
                    Edit Profile
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage your password and account security</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.is_temp_password
                      ? 'You are using a temporary password. Please change it.'
                      : 'Change your account password'}
                  </p>
                </div>
                <Button asChild variant={profile.is_temp_password ? 'default' : 'outline'} size="sm">
                  <Link href="/settings/security">
                    {profile.is_temp_password ? 'Change Now' : 'Change Password'}
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
