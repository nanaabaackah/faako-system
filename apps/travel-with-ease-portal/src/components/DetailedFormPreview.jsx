import { useState } from "react";
import { Button, SelectField, InlineNotice } from "@faako/ui";
import { Question } from "../../../travel-with-ease-web/src/components/EnquiryWizard.jsx";
import { detailedDefinitionSchema, detailedApplicableIds } from "../../../travel-with-ease-api/src/enquiries/questionnaires/configuration.js";
import { questionnaireRoute, questions, SERVICE_OPTIONS } from "../../../travel-with-ease-api/src/enquiries/questionnaires/index.js";

export default function DetailedFormPreview({ definition }) {
  const [viewport,setViewport]=useState("desktop");
  const [entry,setEntry]=useState("general");
  const [answers,setAnswers]=useState({});
  const [index,setIndex]=useState(0);
  const checked=detailedDefinitionSchema.safeParse(definition);
  if(!checked.success)return <InlineNotice tone="warning" title="Preview unavailable" message={checked.error.issues[0].message}/>;
  const context=entry==="package"?{packageId:"sample"}:entry==="general"?{}:{serviceId:entry};
  const route=questionnaireRoute(context,answers);
  const visible=detailedApplicableIds(checked.data,context,answers);
  const steps=checked.data.steps.filter(step=>step.routes.includes(route)).map(step=>({...step,questionIds:step.questionIds.filter(id=>visible.includes(id))})).filter(step=>step.questionIds.length);
  const position=Math.min(index,Math.max(steps.length-1,0));
  const step=steps[position];
  const update=(id,value)=>setAnswers(current=>{
    const next={...current,[id]:value};
    const allowed=detailedApplicableIds(checked.data,context,next);
    return Object.fromEntries(Object.entries(next).filter(([key])=>allowed.includes(key)));
  });
  return <section className="cms-editor-groups" aria-label="Detailed questionnaire draft preview">
    <div className="editor-actions"><Button type="button" aria-pressed={viewport==="desktop"} onClick={()=>setViewport("desktop")}>Desktop</Button><Button type="button" aria-pressed={viewport==="mobile"} onClick={()=>setViewport("mobile")}>Mobile</Button></div>
    <SelectField label="Enquiry context" value={entry} onChangeValue={value=>{setEntry(value);setAnswers({});setIndex(0);}}><option value="general">General enquiry</option><option value="package">Package enquiry</option>{SERVICE_OPTIONS.map(service=><option key={service.id} value={service.id}>{service.title}</option>)}</SelectField>
    <div className="public-enquiry-form smart-enquiry-form" style={{width:"100%",maxWidth:viewport==="mobile"?390:760,marginInline:"auto",minWidth:0}}>
      {step&&<>
        <div className="enquiry-progress"><span>Step {position+1} of {steps.length}</span><progress value={position+1} max={steps.length}/></div>
        <fieldset><legend>{step.title}</legend>{step.questionIds.map(id=>{
          const item=checked.data.questions.find(question=>question.id===id);
          const question={...(questions[id]?.type===item.type?questions[id]:{}),...item};
          return <Question key={id} question={question} value={answers[id]} onChange={value=>update(id,value)} error=""/>;
        })}</fieldset>
        <div className="enquiry-actions"><Button type="button" disabled={position===0} onClick={()=>setIndex(position-1)}>Back</Button>{position<steps.length-1?<Button type="button" onClick={()=>setIndex(position+1)}>{definition.continueLabel}</Button>:<Button type="button" disabled>{definition.submitLabel}</Button>}</div>
      </>}
    </div>
  </section>;
}
