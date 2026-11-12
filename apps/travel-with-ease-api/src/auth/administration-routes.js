import { Router } from "express";
import { z } from "zod";
import { createSuccessResponse, createErrorResponse } from "@faako/api-contracts";
import { ContentError } from "../content/schema.js";
import { readActivity } from './activity.js';

export function administrationRoutes(service, auth) {
  const router=Router();
  const send=(req,res,data)=>res.json(createSuccessResponse(data,{requestId:req.requestId}));
  const id=value=>z.string().uuid().parse(value);
  router.get("/diagnostics",auth.requirePermission("system.read"),async(req,res)=>send(req,res,await service.diagnostics(req.staff,req.requestId)));
  router.get("/security-events",auth.requirePermission("security.read"),async(req,res)=>send(req,res,{items:await service.securityEvents(req.staff,req.requestId)}));
  router.get("/staff",async(req,res)=>send(req,res,{items:await service.staff(req.staff)}));
  router.get("/staff-events",auth.requirePermission("staff.manage"),async(req,res)=>send(req,res,{items:await service.staffEvents(req.staff)}));
  router.get("/handover",async(req,res)=>send(req,res,{request:await service.handoverStatus(req.staff)}));
  router.get('/activity',auth.requirePermission('audit.business.read'),async(req,res)=>send(req,res,await readActivity(service,req.staff,req.query)));
  router.get('/security-activity',auth.requirePermission('security.read'),async(req,res)=>{
    const result=await readActivity(service,req.staff,req.query,true);
    await service.audit(service.pool,req.staff,'system.security_read',null,req.requestId);
    send(req,res,result);
  });
  router.post("/staff/:id/revoke-sessions",auth.requireMutation,async(req,res)=> {
    await service.revokeSessions(req.staff,id(req.params.id),req.requestId);send(req,res,{revoked:true});
  });
  router.post("/staff",auth.requireMutation,async(req,res)=> {
    const input=z.object({subject:z.string().trim().min(1).max(255)}).strict().parse(req.body);
    send(req,res,await service.provision(req.staff,input,req.requestId));
  });
  router.post("/handover",auth.requireMutation,async(req,res)=> {
    const input=z.object({clientId:z.string().uuid(),approvalReference:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/)}).strict().parse(req.body);
    send(req,res,await service.requestHandover(req.staff,req.staffSession,req.staffIdentity,input,req.requestId));
  });
  router.post("/handover/:id/approve",auth.requireMutation,async(req,res)=> {
    z.object({approved:z.literal(true)}).strict().parse(req.body);
    send(req,res,await service.approveHandover(req.staff,req.staffSession,req.staffIdentity,id(req.params.id),req.requestId));
  });
  router.post("/staff/:id/status",auth.requireMutation,async(req,res)=> {
    const input=z.object({active:z.boolean()}).strict().parse(req.body);
    send(req,res,await service.changeStaff(req.staff,id(req.params.id),input.active,req.requestId));
  });
  router.post('/staff/:id/role',auth.requireMutation,auth.requirePermission('staff.roles.manage'),async(req,res)=> {
    const input=z.object({role:z.enum(['owner','editor']),expectedRole:z.enum(['owner','editor']),approvalReference:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/)}).strict().parse(req.body);
    send(req,res,await service.changeRole(req.staff,id(req.params.id),input,req.requestId));
  });
  router.post("/support-grants",auth.requireMutation,auth.requirePermission("support.approve"),async(req,res)=> {
    const input=z.object({userId:z.string().uuid(),minutes:z.number().int().min(1).max(30),reasonReference:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/)}).strict().parse(req.body);
    send(req,res,await service.grantSupport(req.staff,input,req.requestId));
  });
  router.post("/support-grants/:id/revoke",auth.requireMutation,auth.requirePermission("support.approve"),async(req,res)=> {
    await service.revokeSupport(req.staff,id(req.params.id),req.requestId);send(req,res,{revoked:true});
  });
  router.use((error,req,res,next)=> {
    if (!(error instanceof z.ZodError) && !(error instanceof ContentError) && error.code!=="23505") return next(error);
    res.status(error.status || (error.code==="23505"?409:400)).json(createErrorResponse({code:error instanceof ContentError?error.code:error.code==="23505"?"conflict":"validation_error",message:error instanceof ContentError?error.message:"Check the administrative request; it may already exist."},{requestId:req.requestId}));
  });
  return router;
}
