import type {EvidenceArtifact,RunEvent} from "./contracts";
export interface EvidenceNode {id:string;type:"claim"|"source"|"artifact"|"result";label:string;refs:string[];confidence?:number;}
export class EvidenceGraph {
 private nodes=new Map<string,EvidenceNode>();
 add(node:EvidenceNode){this.nodes.set(node.id,node);}
 attachArtifact(artifact:EvidenceArtifact){this.add({id:artifact.id,type:"artifact",label:artifact.uri,refs:[artifact.source]});}
 record(event:RunEvent){this.add({id:event.taskId+":"+event.timestamp,type:"result",label:event.type,refs:[event.source]});}
 list(){return [...this.nodes.values()];}
}
