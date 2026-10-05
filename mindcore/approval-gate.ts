import type {ApprovalLevel,TaskContext} from "./contracts";
const rank:Record<ApprovalLevel,number>={none:0,user:1,admin:2,"human-gate":3};
export function requireApproval(context:TaskContext,required:ApprovalLevel){if(rank[context.approval]<rank[required])throw new Error("Approval required: "+required);}
