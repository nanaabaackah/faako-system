import { TextField, TextareaField, SelectField, InlineNotice } from "@faako/ui";
import Button from "./ActionButton.jsx";
import { detailedDefinitionSchema, protectedQuestionIds, DETAILED_ROUTES } from "../../../travel-with-ease-api/src/enquiries/questionnaires/configuration.js";

const routeLabels = { router: "Undecided", planning: "Full planning / premium", safe_general: "Readiness", package: "Package", group: "Group planning" };
const types = [["TEXT","Short text"],["PARAGRAPH_TEXT","Long text"],["MULTIPLE_CHOICE","Single choice"],["CHECKBOX","Multiple selection"],["DROPDOWN","Dropdown"],["DATE","Date"],["NUMBER","Number"]];
const choice = type => ["MULTIPLE_CHOICE","CHECKBOX","DROPDOWN"].includes(type);
const reorder = (items, i, delta) => {
  const next = [...items];
  [next[i],next[i+delta]] = [next[i+delta],next[i]];
  return next;
};
function newId(questions) {
  let id;
  do { id = "9" + Array.from(crypto.getRandomValues(new Uint8Array(11)), value => value % 10).join(""); }
  while (questions.some(item => item.id === id));
  return id;
}
export default function DetailedQuestionFields({ definition, edit, blocked }) {
  const checked = detailedDefinitionSchema.safeParse(definition);
  const field = (id, transform) => edit(body => ({ ...body, questions: body.questions.map(question => question.id === id ? transform(question) : question) }));
  const stepEdit = (id, transform) => edit(body => ({ ...body, steps: body.steps.map(step => step.id === id ? transform(step) : step) }));
  const clean = body => ({ ...body, questions: body.questions.filter(question => body.steps.some(step => step.questionIds.includes(question.id))) });
  function appendQuestion(stepId) {
    edit(body => {
      const id = newId(body.questions);
      return { ...body, questions: [...body.questions, { id,label:"New question",description:"",type:"TEXT",required:false,options:[] }], steps: body.steps.map(step => step.id === stepId ? { ...step, questionIds:[...step.questionIds,id] } : step) };
    });
  }
  function addStep() {
    edit(body => {
      const id = newId(body.questions);
      return { ...body, questions: [...body.questions, { id,label:"New question",description:"",type:"TEXT",required:false,options:[] }], steps: [...body.steps, { id: "step-"+crypto.randomUUID(),title:"New step",routes:["package"],questionIds:[id] }] };
    });
  }
  return <div className="cms-editor-groups">
    <TextField label="Continue button" value={definition.continueLabel} maxLength={240} required disabled={blocked} onChange={event => edit(body => ({ ...body, continueLabel:event.target.value }))}/>
    <TextField label="Submit button" value={definition.submitLabel} maxLength={240} required disabled={blocked} onChange={event => edit(body => ({ ...body, submitLabel:event.target.value }))}/>
    {!checked.success && <InlineNotice tone="warning" title="Resolve configuration issues before activation" message={checked.error.issues[0].message}/>}
    {definition.steps.map((step,index) => <fieldset className="cms-editor-group" key={step.id}>
      <legend>{step.title}</legend>
      <TextField label="Step title" value={step.title} maxLength={240} required disabled={blocked} onChange={event => stepEdit(step.id,item => ({ ...item,title:event.target.value }))}/>
      {DETAILED_ROUTES.map(route => <SelectField key={route} label={routeLabels[route]} value={step.routes.includes(route)?"show":"hide"} disabled={blocked || (step.routes.length===1 && step.routes.includes(route))} onChangeValue={value => stepEdit(step.id,item => ({ ...item,routes:value==="show"?[...new Set([...item.routes,route])]:item.routes.filter(name=>name!==route) }))}><option value="show">Show step</option><option value="hide">Hide step</option></SelectField>)}
      <div className="editor-actions">
        <Button type="button" icon="up" disabled={blocked || index===0} onClick={()=>edit(body=>({...body,steps:reorder(body.steps,index,-1)}))}>Move step up</Button>
        <Button type="button" icon="down" disabled={blocked || index===definition.steps.length-1} onClick={()=>edit(body=>({...body,steps:reorder(body.steps,index,1)}))}>Move step down</Button>
        <Button type="button" icon="close" disabled={blocked || definition.steps.length===1 || step.questionIds.some(id=>protectedQuestionIds.includes(id))} onClick={()=>edit(body=>clean({...body,steps:body.steps.filter(item=>item.id!==step.id)}))}>Remove step</Button>
      </div>
      {step.questionIds.map((id,position) => {
        const question=definition.questions.find(item=>item.id===id);
        if(!question)return null;
        const locked=protectedQuestionIds.includes(id);
        const candidates=definition.questions.filter(item=>item.id!==id && choice(item.type));
        const dependency=candidates.find(item=>item.id===question.condition?.questionId);
        return <fieldset className="cms-editor-group" key={id}>
          <legend>{question.label}</legend>
          <TextField label="Question label" value={question.label} maxLength={240} required disabled={blocked} onChange={event=>field(id,item=>({...item,label:event.target.value}))}/>
          <TextareaField label="Description" value={question.description} maxLength={2000} disabled={blocked} onChange={event=>field(id,item=>({...item,description:event.target.value}))}/>
          <SelectField label="Answer type" value={question.type} disabled={blocked||locked} onChangeValue={type=>field(id,item=>({...item,type,options:choice(type)?(choice(item.type)?item.options:["Choice 1","Choice 2"]):[]}))}>{types.map(([value,label])=><option key={value} value={value}>{label}</option>)}</SelectField>
          <SelectField label="Answer requirement" value={question.required?"required":"optional"} disabled={blocked||locked} onChangeValue={value=>field(id,item=>({...item,required:value==="required"}))}><option value="optional">Optional</option><option value="required">Required</option></SelectField>
          {choice(question.type)&&<div className="cms-editor-groups">
            {question.options.map((option,i)=><div className="editor-actions" key={i}>
              <TextField label={"Choice "+(i+1)} value={option} required maxLength={240} disabled={blocked||locked} onChange={event=>field(id,item=>({...item,options:item.options.map((value,j)=>j===i?event.target.value:value)}))}/>
              {!locked&&<Button type="button" icon="close" disabled={blocked||question.options.length<=2} onClick={()=>field(id,item=>({...item,options:item.options.filter((_,j)=>j!==i)}))}>Remove choice</Button>}
            </div>)}
            {!locked&&<Button type="button" icon="plus" disabled={blocked||question.options.length>=30} onClick={()=>field(id,item=>({...item,options:[...item.options,"Choice "+(item.options.length+1)]}))}>Add choice</Button>}
          </div>}
          {!locked&&<>
            <SelectField label="Show when" value={question.condition?.questionId||""} disabled={blocked} onChangeValue={value=>field(id,item=>{const next={...item}; if(value)next.condition={questionId:value,option:candidates.find(parent=>parent.id===value)?.options[0]||""};else delete next.condition;return next;})}>
              <option value="">Always on this route</option>{candidates.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
            </SelectField>
            {dependency&&<SelectField label="Selected answer" value={question.condition.option} disabled={blocked} onChangeValue={value=>field(id,item=>({...item,condition:{...item.condition,option:value}}))}>{dependency.options.map((option,i)=><option key={i} value={option}>{option}</option>)}</SelectField>}
          </>}
          <div className="editor-actions">
            <Button type="button" icon="up" disabled={blocked||position===0} onClick={()=>stepEdit(step.id,item=>({...item,questionIds:reorder(item.questionIds,position,-1)}))}>Move question up</Button>
            <Button type="button" icon="down" disabled={blocked||position===step.questionIds.length-1} onClick={()=>stepEdit(step.id,item=>({...item,questionIds:reorder(item.questionIds,position,1)}))}>Move question down</Button>
            {!locked&&<Button type="button" icon="close" disabled={blocked||step.questionIds.length===1} onClick={()=>edit(body=>clean({...body,steps:body.steps.map(item=>item.id===step.id?{...item,questionIds:item.questionIds.filter(value=>value!==id)}:item)}))}>Remove question</Button>}
          </div>
        </fieldset>;
      })}
      <Button type="button" icon="plus" disabled={blocked||definition.questions.length>=100||step.questionIds.length>=50} onClick={()=>appendQuestion(step.id)}>Add question</Button>
    </fieldset>)}
    <Button type="button" icon="plus" disabled={blocked||definition.steps.length>=40||definition.questions.length>=100} onClick={addStep}>Add step</Button>
  </div>;
}
