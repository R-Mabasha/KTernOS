import type { FC } from 'react'
import type { SAPApprovalPayload } from '@/lib/sap/types'

interface ApprovalPromptProps {
  taskId: string
  payload: SAPApprovalPayload
  onApprove: (taskId: string) => void
  onCancel: (taskId: string) => void
}

export const ApprovalPrompt: FC<ApprovalPromptProps> = ({ taskId, payload, onApprove, onCancel }) => {
  return (
    <div className="mx-3 mt-3 rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm">
      <div className="mb-2 font-semibold text-red-900">Action requires your approval</div>
      <div className="space-y-1 text-sm text-red-950">
        <div><span className="font-medium">Action:</span> {payload.action}</div>
        <div><span className="font-medium">Target:</span> {payload.target}</div>
        <div><span className="font-medium">Landscape:</span> {payload.landscape}</div>
        <div><span className="font-medium">System:</span> {payload.system}</div>
        <div><span className="font-medium">Estimated effect:</span> {payload.estimatedEffect}</div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white"
          onClick={() => onApprove(taskId)}
          type="button"
        >
          Approve
        </button>
        <button
          className="rounded-md border border-red-400 bg-white px-3 py-2 text-sm font-medium text-red-700"
          onClick={() => onCancel(taskId)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
