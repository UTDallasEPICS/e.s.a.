/**
 * Purpose
 * Run the ai capability suite maintenance task.
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
import {writeFileSync} from 'node:fs'
import {runAcademicQuestion} from '../server/utils/ai/academicReport'
import {normalizeV1Response} from '../app/components/database-redesign/aiResultPresentation'
// Define cases for the steps below.
const cases:any[]=[
 {name:'Written enrollment answer + typos',q:'how many studnets are in fall 26',s:'SP26',count:159},
 {name:'Semester filter',q:'bar graph student course breakdown',s:'SP26',chart:'bar',sum:150},
 {name:'Horizontal bars',q:'horizontal bar chart of students by major',s:'FA26',chart:'horizontalBar',sum:159},
 {name:'Stacked comparison',q:'stacked bar chart of students by semester and course across semesters',s:'FA26',chart:'stackedBar',sum:309},
 {name:'Line comparison',q:'compare Spring and Fall 2026 enrollment in a line graph',s:'FA26',chart:'line',sum:309},
 {name:'Area comparison',q:'area graph of students by semester across semesters',s:'FA26',chart:'area',sum:309},
 {name:'Pie + explicit semester override',q:'pie graph of students by class year fall 2026',s:'SP26',chart:'pie',sum:159},
 {name:'Donut + typos',q:'donut graoh of majors fall 2026',s:'SP26',chart:'doughnut',sum:159},
 {name:'Radar',q:'radar chart of students by class year',s:'FA26',chart:'radar',sum:159},
 {name:'Polar area',q:'polar area chart of students by course',s:'FA26',chart:'polarArea',sum:159},
 {name:'Sankey student flows + typos',q:'sanky students class year to project 2026 fall',s:'SP26',chart:'sankey',sum:158},
 {name:'Sankey course to project',q:'sankey graph students course to project',s:'FA26',chart:'sankey',sum:158},
 {name:'Scatter with recorded measures',q:'scatter plot per partner: x is count of projects, y is total team size',s:'FA26',chart:'scatter'},
 {name:'Bubble with recorded measures',q:'bubble plot per partner: x is count of projects, y is total team size, bubble size is average team size',s:'FA26',chart:'bubble'},
 {name:'Histogram of real team sizes',q:'histogram of project team sizes',s:'FA26',chart:'bar',sum:31},
 {name:'Project roster list',q:'who is working on Inventory Tracking this semester',s:'FA26',list:true},
 {name:'Partner count',q:'how many community partners in Fall 2026',s:'SP26',count:29},
 {name:'Project count Spring',q:'how many projects spring 2026',s:'FA26',count:29},
 {name:'New projects in Spring',q:'how many new projects spring 2026',s:'FA26',count:10},
 {name:'New projects in Fall',q:'how many new projects fall 2026',s:'SP26',count:18},
 {name:'Follow-up changes chart',q:'make it pie',s:'FA26',previous:'students by course spring 2026 bar graph',chart:'pie',sum:150},
 {name:'Follow-up changes semester',q:'and fall instead',s:'SP26',previous:'pie chart of students by course spring 2026',chart:'pie',sum:159},
 {name:'Unavailable semester',q:'students by course summer 2026 bar graph',s:'FA26',status:'no_data'},
 {name:'Missing numeric measures',q:'scatter graph of students by major',s:'FA26',status:'clarification_needed'},
 {name:'Unavailable exact timeline',q:'give the exact start date and end date of every project',s:'FA26',status:'unsupported_capability'},
 {name:'Missing chart data category',q:'make me a graph',s:'FA26',status:'clarification_needed'},
]
// Compute independent expected partner population from the verified source rows.
import source from '../app/components/verified-data.json'
// Update cases.find(c=>c.name==='Partner count').count with the value on the right.
cases.find(c=>c.name==='Partner count').count=new Set(source.projects.filter(p=>p.semesters.includes('FA26')).map(p=>p.partnerId)).size
// Define the helper that will main.
async function main(){
 // Define evidence for the steps below.
 const evidence:any[]=[]
 // Repeat the following steps for each item in cases.
 for(const c of cases){
  // Use Date.now to initialize started.
  const started=Date.now()
  // Define raw for the steps below.
  const raw=await runAcademicQuestion(c.q,c.s,{authorized:true,previousQuestion:c.previous,requestPlan:async messages=>{
   // Define response for the steps below.
   const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${process.env.NUXT_OPENROUTER_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek/deepseek-v4-flash-0731',messages,reasoning:{enabled:false},temperature:0,max_tokens:3000,response_format:{type:'json_object'}})})
   // Check whether !response.ok before running this branch.
   if(!response.ok)throw Error(`Provider HTTP ${response.status}`)
   // Pass (await response.json()).choices?.[0]?.message?.content back to the caller.
   return (await response.json()).choices?.[0]?.message?.content
  }})
  // Define view for the steps below.
  const view=normalizeV1Response(raw)!
  // Define actualChart for the steps below.
  const actualChart=view.sankey?'sankey':view.plot?.type??view.chart?.type
  // Define sum for the steps below.
  const sum=view.sankey?view.sankey.links.reduce((n,l)=>n+l.value,0):view.chart?.series.reduce((n,s)=>n+s.values.reduce((a,b)=>a+b,0),0)
  // Define failures for the steps below.
  const failures:string[]=[]
  // Check whether raw.status!==(c.status??'answer') before running this branch.
  if(raw.status!==(c.status??'answer'))failures.push(`Expected ${c.status??'answer'}, got ${raw.status}`)
  // Check whether c.count!==undefined&&view.summary?.value!==c.count before running this branch.
  if(c.count!==undefined&&view.summary?.value!==c.count)failures.push(`Expected count ${c.count}, got ${view.summary?.value}`)
  // Check whether c.chart&&actualChart!==c.chart before running this branch.
  if(c.chart&&actualChart!==c.chart)failures.push(`Expected chart ${c.chart}, got ${actualChart}`)
  // Check whether c.sum!==undefined&&sum!==c.sum before running this branch.
  if(c.sum!==undefined&&sum!==c.sum)failures.push(`Expected plotted total ${c.sum}, got ${sum}`)
  // Check whether c.list&&!(view.result?.kind==='records'&&view.result.rows.length>0) before running this branch.
  if(c.list&&!(view.result?.kind==='records'&&view.result.rows.length>0))failures.push('Expected real roster rows')
  // Define details for the steps below.
  const details={name:c.name,question:c.q,selectedSemester:c.s,previousQuestion:c.previous,passed:!failures.length,failures,status:raw.status,explanation:raw.explanation,chart:actualChart,summary:view.summary,sum,rowCount:view.result?.rows.length,seconds:Math.round((Date.now()-started)/100)/10,presentation:c.list?{status:view.status,explanation:view.explanation,listCount:view.result?.rows.length}:view}
  // Call evidence.push to run this step.
  evidence.push(details)
  // Call writeFileSync to run this step.
  writeFileSync('C:/Users/samla/Documents/ESA/fall2026-import/ai-capability-results.json',JSON.stringify({testedAt:new Date().toISOString(),model:'deepseek/deepseek-v4-flash-0731',tests:evidence},null,2))
  // Call console.log to run this step.
  console.log(JSON.stringify({name:c.name,passed:details.passed,status:details.status,failures}))
 }
 // Call console.log to run this step.
 console.log(`Passed ${evidence.filter(r=>r.passed).length}/${evidence.length} live tests.`)
}
// Call main().catch to run this step.
main().catch(e=>{console.error(e.message);process.exitCode=1})
