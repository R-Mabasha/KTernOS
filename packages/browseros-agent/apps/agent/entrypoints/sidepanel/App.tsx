import { type FC, useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import type { SAPApprovalPayload, SAPApprovalRequestMessage } from '@/lib/sap/types'
import { ChatHistory } from './history/ChatHistory'
import { Chat } from './index/Chat'
import { ChatLayout } from './layout/ChatLayout'
import { ApprovalPrompt } from './components/ApprovalPrompt'

type ApprovalQueueItem = {
  taskId: string
  payload: SAPApprovalPayload
}

export const App: FC = () => {
  const [approvals, setApprovals] = useState<ApprovalQueueItem[]>([])

  useEffect(() => {
    const listener = (message: unknown) => {
      const approvalMessage = message as SAPApprovalRequestMessage
      if (approvalMessage?.type !== 'SAP_APPROVAL_REQUIRED') return
      setApprovals((current) => {
        if (current.some((item) => item.taskId === approvalMessage.taskId)) return current
        return [...current, { taskId: approvalMessage.taskId, payload: approvalMessage.payload }]
      })
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const respond = (taskId: string, approved: boolean) => {
    void chrome.runtime.sendMessage({ type: 'SAP_APPROVAL_RESPONSE', taskId, approved })
    setApprovals((current) => current.filter((item) => item.taskId !== taskId))
  }

  return (
    <>
      {approvals.map((approval) => (
        <ApprovalPrompt
          key={approval.taskId}
          taskId={approval.taskId}
          payload={approval.payload}
          onApprove={(id) => respond(id, true)}
          onCancel={(id) => respond(id, false)}
        />
      ))}
      <HashRouter>
        <Routes>
          <Route element={<ChatLayout />}>
            <Route index element={<Chat />} />
            <Route path="history" element={<ChatHistory />} />
          </Route>
        </Routes>
      </HashRouter>
    </>
  )
}
