/**
 * Purpose
 * Run the deep live ai audit maintenance task.
 *
 * Inputs
 * - The project files, configuration, or data read by this task.
 *
 * Outputs
 * - The task’s output, file or database changes, or an error when a check fails.
 *
 * Pseudocode
 * Load the task inputs → run its steps → report the outcome.
 */
import 'dotenv/config'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import source from '../app/components/verified-data.json'
import {academicRows,executeAcademicPlan,runAcademicQuestion,fields} from '../server/utils/ai/academicReport'
import {loadReportData,withReportData} from '../server/utils/ai/academicReportData'
import {reportConversation,rememberReport,safeResultContext,followUpQuestion} from '../server/utils/ai/academicReportConversation'
import {localLookup,localRefinement,cachedReportPlan} from '../server/utils/ai/reportPlanCacheAndShortcuts'
import {normalizeV1Response} from '../app/components/database-redesign/aiResultPresentation'
import {prisma} from '../server/utils/prisma'
// Define tests for the steps below.
const tests:any[]=[]
// Define data for the steps below.
const data=await loadReportData()
// Use reportConversation to initialize session.
const session=reportConversation('local-ai-capability-audit',undefined)
// Define summary for the steps below.
const summary=(result:any)=>normalizeV1Response(result)?.summary?.value
// Define the helper that will ask.
async function ask(name:string,question:string,check:(result:any)=>void,follow=false){
 // Use Date.now to initialize started.
 const started=Date.now();let calls=0
 // Define last for the steps below.
 const last=follow?session.session.turns.at(-1):undefined
 // Define lastAnswer for the steps below.
 const lastAnswer=follow?session.session.turns.findLast(t=>t.plan&&t.result):undefined
 // Define result for the steps below.
 const result=await withReportData(data,()=>runAcademicQuestion(question,'SP26',{authorized:true,previousQuestion:last&&followUpQuestion(question)?last.question:undefined,previousPlan:last?.plan??lastAnswer?.plan,previousScope:last?.semesterScope??lastAnswer?.semesterScope,resultContext:safeResultContext(last),localPlan:(plan,q)=>localRefinement(plan,q)??localLookup(q),requestPlan:messages=>cachedReportPlan('local-ai-capability-audit','deepseek/deepseek-v4-flash-0731',messages,async()=>{
  calls++
  // Define response for the steps below.
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${process.env.NUXT_OPENROUTER_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek/deepseek-v4-flash-0731',messages,reasoning:{enabled:false},temperature:0,max_tokens:4000,response_format:{type:'json_object'}})})
  // Check whether !response.ok before running this branch.
  if(!response.ok)throw Error(`Provider HTTP ${response.status}`)
  // Pass (await response.json()).choices?.[0]?.message?.content back to the caller.
  return (await response.json()).choices?.[0]?.message?.content
 })}))
 // Define failure for the steps below.
 let failure='';try{check(result)}catch(error){failure=error instanceof Error?error.message:String(error)}
 // Use normalizeV1Response to initialize view.
 const view=normalizeV1Response(result)
 // Define evidence for the steps below.
 const evidence={name,question,passed:!failure,failure,status:result.status,ms:Date.now()-started,modelCalls:calls,presentation:view,plan:result.plan}
 // Call tests.push to run this step.
 tests.push(evidence)
 // Check whether follow before running this branch.
 if(follow)rememberReport(session.session,question,result,'SP26')

 // Call console.log to run this step.
 console.log(JSON.stringify({name,passed:evidence.passed,status:result.status,ms:evidence.ms,modelCalls:calls,...(failure?{failure}:{})}))
 // Pass result back to the caller.
 return result
}
try{
 await ask('Fast partner lookup','Who was the partner for Inventory Tracking in Fall 2026?',r=>{assert.equal(r.status,'answer');assert.ok(r.result.rows.some((row:any)=>String(row.values.partner).includes('Hope Restored')));assert.ok(r.result.rows.some((row:any)=>row.references?.some((ref:any)=>ref.type==='partner')))})
 await ask('Fast enrollment lookup','How many students are enrolled in Fall 2026?',r=>assert.equal(summary(r),159))
 await ask('Many spelling errors','shwo bar graoh studnets by majrs flal2026',r=>{assert.equal(r.status,'answer');const v=normalizeV1Response(r)!;assert.equal(v.chart?.type,'bar');assert.equal(v.chart?.series[0]?.values.reduce((a,b)=>a+b,0),159)})
 await ask('Unclear wording offers choices','zzqx pppv uhhh whaa grrrr?',r=>{assert.ok(['clarification_needed','unsupported_capability'].includes(r.status));assert.ok(normalizeV1Response(r)?.suggestions?.length)})
 await ask('Demographic semester comparison','Compare students by gender between Spring and Fall 2026 in a stacked bar graph',r=>{assert.equal(r.status,'answer');const v=normalizeV1Response(r)!;assert.equal(v.chart?.type,'stackedBar');assert.equal(v.chart?.series.reduce((n,s)=>n+s.values.reduce((a,b)=>a+b,0),0),309);assert.ok(r.result.columns.some((c:any)=>c.tableOnly))})
 await ask('Compare real projects','Compare projects 72 and 75 in Fall 2026: show partner, mentor, and team size',r=>{assert.equal(r.status,'answer');assert.equal(r.result.rows.length,2)})
 await ask('Recorded mentor data','Show project mentors and their recorded emails in Spring 2026',r=>{assert.equal(r.status,'answer');assert.ok(r.result.rows.length>0);assert.ok(r.result.columns.some((c:any)=>c.key==='mentorEmail'))})
 await ask('Recorded contact data','Show primary partner contacts, contact emails and phone numbers for Spring 2026',r=>{assert.equal(r.status,'answer');assert.ok(r.result.rows.length>0);assert.ok(r.result.columns.some((c:any)=>c.key==='contactEmail'))})
 await ask('Student-supplied notes','Show students with nonempty survey comments in Spring 2026 and their comments',r=>{assert.equal(r.status,'answer');assert.ok(r.result.rows.length>0);assert.ok(r.result.columns.some((c:any)=>c.key==='comments'));assert.ok(r.result.rows.every((row:any)=>row.values.comments))})
 await ask('All recorded preferences','How many submitted preferences are recorded across all semesters?',r=>assert.equal(summary(r),source.choices.length))
 await ask('Percentage growth','What was the percentage growth in student enrollment from Spring 2026 to Fall 2026?',r=>{assert.equal(r.status,'answer');assert.ok(Math.abs(summary(r)!-6)<1e-8)})
 await ask('Start multi-turn refinement','Show a bar graph of students by major in Fall 2026',r=>assert.equal(r.status,'answer'),true)
 await ask('Follow-up narrows population','only first-years',r=>{assert.equal(r.status,'answer');assert.deepEqual(r.semesterScope,['Fall 2026']);assert.ok(r.plan.filters.some((f:any)=>f.field==='classYear'))},true)
 await ask('Follow-up removes unknown values','exclude unknowns',r=>{assert.equal(r.status,'answer');assert.ok(r.plan.filters.some((f:any)=>f.field==='classYear'));assert.ok(r.plan.filters.some((f:any)=>f.operator==='isNotEmpty'))},true)
 await ask('Follow-up ranks results','top 5',r=>{assert.equal(r.status,'answer');assert.equal(r.plan.limit,5);assert.deepEqual(r.semesterScope,['Fall 2026'])},true)
 await ask('Follow-up changes chart','make it pie',r=>{assert.equal(r.status,'answer');assert.equal(normalizeV1Response(r)?.chart?.type,'pie');assert.ok(r.plan.filters.some((f:any)=>f.field==='classYear'));assert.deepEqual(r.semesterScope,['Fall 2026'])},true)
 await ask('Percentage table composition','Pie graph of students by course Fall 2026',r=>{assert.equal(r.status,'answer');const share=r.result.columns.find((c:any)=>c.tableOnly);assert.ok(share);assert.ok(Math.abs(r.result.rows.reduce((n:number,row:any)=>n+row.values[share.key],0)-100)<1e-8)})
 await ask('Interpretation cache first request','Horizontal bar graph of students by course Fall 2026',r=>assert.equal(r.status,'answer'))
 await ask('Interpretation cache repeated request','Horizontal bar graph of students by course Fall 2026',r=>assert.equal(r.status,'answer'))
 // Use withReportData to initialize inventory.
 const inventory=withReportData(data,()=>Object.fromEntries(Object.keys(fields).map(source=>[source,{fields:(fields as any)[source],rows:academicRows(source as any).length}])))
 // Call writeFileSync to run this step.
 writeFileSync('C:/Users/samla/Documents/ESA/fall2026-import/ai-data-coverage.json',JSON.stringify({testedAt:new Date().toISOString(),inventory,securityBoundary:'Academic records only; authenticated administrator required. Credentials, API keys and authentication records are excluded.',remainingBoundaries:['Uncollected facts such as exact project start/end dates cannot be invented.','Garbled or ambiguous questions can require client selection of a proposed interpretation.','First-time external model requests can exceed three seconds.','Conversation context expires after 30 minutes of inactivity; query plans are cached for ten minutes.']},null,2))






 // Call writeFileSync to run this step.
 writeFileSync('C:/Users/samla/Documents/ESA/fall2026-import/ai-audit-results.json',JSON.stringify({testedAt:new Date().toISOString(),tests},null,2))
 // Use tests.map(t=>t.ms).sort to initialize times.
 const times=tests.map(t=>t.ms).sort((a,b)=>a-b)
 // Call console.log to run this step.
 console.log(JSON.stringify({passed:tests.filter(t=>t.passed).length,total:tests.length,medianMs:times[Math.floor(times.length/2)],maxMs:times.at(-1),under3seconds:tests.filter(t=>t.ms<=3000).length}))
 // Check whether tests.some(t=>!t.passed) before running this branch.
 if(tests.some(t=>!t.passed))process.exitCode=1
}finally{await prisma.$disconnect()}
