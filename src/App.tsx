import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Download, LayoutDashboard, LogOut, Plus, Search, Settings2, Users, Wallet, X, UserRound, CalendarCheck, AlertCircle, LockKeyhole, QrCode, Copy, Truck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Profile = { user_id: string; full_name: string; role: "admin" | "recorder"; company_id: string; branch_id: string | null; must_change_password: boolean };
type Branch = { id: string; name: string };
type Employee = { id: string; company_id: string; branch_id: string; name: string; active: boolean; effective_from: string; dailyRate: 120 | 150; pix_key?: string | null; pix_key_type?: string | null; pix_city?: string | null };
type Attendance = { id: string; company_id: string; branch_id: string; employee_id: string; work_date: string; status: "worked" | "absent" | "off" };
type Overtime = { id: string; employee_id: string; work_date: string; branch_id: string; company_id: string };
type Payment = { employee_id: string; week_start: string; paid: boolean; paid_at?: string };
const todayISO = () => { const d = new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const shiftDate = (date: string, days: number) => { const d = new Date(date+"T12:00:00"); d.setDate(d.getDate()+days); return dateFrom(d); };
const dateFrom = (d: Date) => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const mondayOf = (date: string) => { const d=new Date(date+"T12:00:00"); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateFrom(d); };
const money = (n: number) => n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtDate = (date: string) => new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
const pixField=(id:string,value:string)=>id+String(value.length).padStart(2,"0")+value;
const crc16=(value:string)=>{let crc=0xffff;for(let i=0;i<value.length;i++){crc^=value.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xffff;}return crc.toString(16).toUpperCase().padStart(4,"0");};
const normalizeReceiverBranch=(value?:string|null)=>{const normalized=(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();return normalized==="RODOTEC"?"Rodotec":"Juína";};
const buildPixPayload=(key:string,name:string,amount:number,cityValue:string)=>{const merchant=(name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9 ]/g,"").trim().toUpperCase().slice(0,25)||"RECEBEDOR");const city=(cityValue.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9 ]/g,"").trim().toUpperCase().slice(0,15)||"JUINA");const gui=pixField("00","br.gov.bcb.pix")+pixField("01",key.trim());const account=pixField("26",gui);const base="000201"+pixField("01","12")+account+"52040000"+"5303986"+pixField("54",amount.toFixed(2))+"5802BR"+pixField("59",merchant)+pixField("60",city)+"62070503***"+"6304";return base+crc16(base);};
const db = supabase!;
const usernameEmail: Record<string,string> = { marcos:"admin@rm.com.br", juina:"juina@rm.com.br", rodotec:"rodotec@rm.com.br" };

export default function App() {
  const [session,setSession]=useState<any>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [branchId,setBranchId]=useState("");
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [attendance,setAttendance]=useState<Attendance[]>([]);
  const [overtime,setOvertime]=useState<Overtime[]>([]);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [tab,setTab]=useState("inicio");
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const [weekStart,setWeekStart]=useState(mondayOf(todayISO()));
  const [query,setQuery]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [loginBusy,setLoginBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  const [employeeName,setEmployeeName]=useState("");
  const [employeeRate,setEmployeeRate]=useState<"120"|"150">("120");
  const [employeePixKey,setEmployeePixKey]=useState("");
  const [employeePixType,setEmployeePixType]=useState("aleatoria");
  const [employeePixCity,setEmployeePixCity]=useState("Juína");
  const [pixPayment,setPixPayment]=useState<{name:string;key:string;amount:number;city:string}|null>(null);
  const [editingEmployee,setEditingEmployee]=useState<Employee|null>(null);
  const [recordEmployee,setRecordEmployee]=useState("");
  const [expandedWeekStart,setExpandedWeekStart]=useState(mondayOf(todayISO()));

  const notify=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(""),2600);};
  const loadProfile=useCallback(async (userId:string)=>{
    const {data,error:profileError}=await db.rpc("get_my_security_status");
    if(profileError) throw profileError;
    const p=(Array.isArray(data)?data[0]:data) as Profile|undefined;
    if(!p || p.user_id!==userId) throw new Error("Usuário sem perfil RM. Peça ao administrador técnico para conferir o cadastro.");
    setProfile(p);
    const {data:branchData,error:branchError}=await db.from("branches").select("id,name").eq("company_id",p.company_id).order("name");
    if(branchError) throw branchError;
    setBranches(branchData??[]);
    setBranchId(p.role==="admin" ? ((branchData??[]).find((b:Branch)=>b.name==="JUÍNA")?.id??branchData?.[0]?.id??"") : (p.branch_id??""));
    return p;
  },[]);
  const loadData=useCallback(async (p:Profile,selectedBranch:string)=>{
    if(!selectedBranch) return;
    setLoading(true);
    try {
      const empRes=await db.from("employees").select("id,company_id,branch_id,name,active,effective_from,pix_key,pix_key_type,pix_city").eq("company_id",p.company_id).eq("branch_id",selectedBranch).order("name");
      if(empRes.error) throw empRes.error;
      const employeeIds=(empRes.data??[]).map((e:any)=>e.id);
      const [attRes,otRes,payRes,rateRes,attRateRes]=await Promise.all([
        db.from("attendance").select("id,company_id,branch_id,employee_id,work_date,status").eq("company_id",p.company_id).eq("branch_id",selectedBranch),
        db.from("overtime").select("id,employee_id,work_date,branch_id,company_id").eq("company_id",p.company_id).eq("branch_id",selectedBranch),
        p.role==="admin" ? db.from("payments").select("employee_id,week_start,paid,paid_at").eq("company_id",p.company_id).eq("branch_id",selectedBranch) : Promise.resolve({data:[],error:null} as any),
        employeeIds.length ? db.from("employee_rates").select("employee_id,daily_rate").in("employee_id",employeeIds) : Promise.resolve({data:[],error:null} as any),
        p.role==="admin" ? db.from("attendance_rates").select("attendance_id,daily_rate") : Promise.resolve({data:[],error:null} as any)
      ]);
      for(const r of [attRes,otRes,payRes,rateRes,attRateRes]) if(r.error) throw r.error;
      const rates=new Map((rateRes.data??[]).map((r:any)=>[r.employee_id,r.daily_rate]));
      const attRates=new Map((attRateRes.data??[]).map((r:any)=>[r.attendance_id,r.daily_rate]));
      setEmployees((empRes.data??[]).map((e:any)=>({...e,dailyRate:(rates.get(e.id)??120) as 120|150})));
      setAttendance((attRes.data??[]).map((a:any)=>({...a,dailyRate:attRates.get(a.id)})));
      setOvertime(otRes.data??[]);
      setPayments(payRes.data??[]);
    } catch(e:any){setError(e.message??"Não foi possível carregar os dados.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    if(!isSupabaseConfigured || !supabase){setLoading(false);return;}
    let alive=true;
    db.auth.getSession().then(async ({data})=>{
      if(!alive)return;
      setSession(data.session);
      if(data.session){try{const p=await loadProfile(data.session.user.id);if(alive)await loadData(p,p.role==="admin"?(branches[0]?.id??""):p.branch_id??"");}catch(e:any){setError(e.message);await db.auth.signOut();}}
      else setLoading(false);
    });
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,s)=>{setSession(s);if(!s){setProfile(null);setEmployees([]);setAttendance([]);setOvertime([]);setPayments([]);setLoading(false);}});
    return()=>{alive=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(profile&&branchId)void loadData(profile,branchId);},[profile,branchId,loadData]);

  const login=async(e:React.FormEvent)=>{e.preventDefault();setError("");const key=username.trim().toLowerCase();const email=usernameEmail[key];if(!email){setError("Usuário inválido.");return;}setLoginBusy(true);try{const {data,error:authError}=await db.auth.signInWithPassword({email,password});if(authError)throw authError;setSession(data.session);const p=await loadProfile(data.user.id);await loadData(p,p.role==="admin"?(branches[0]?.id??""):p.branch_id??"");setPassword("");}catch(e:any){setError(e.message==="Invalid login credentials"?"Usuário ou senha incorretos.":e.message??"Falha ao entrar.");}finally{setLoginBusy(false);}};
  const changePassword=async(e:React.FormEvent)=>{e.preventDefault();setError("");if(newPassword.length<8){setError("A nova senha precisa ter pelo menos 8 caracteres.");return;}if(newPassword!==confirmPassword){setError("As senhas não conferem.");return;}setSaving(true);try{const {error:changeError}=await db.auth.updateUser({password:newPassword});if(changeError)throw changeError;const {error:rpcError}=await db.rpc("complete_password_change",{new_password:newPassword});if(rpcError)throw rpcError;setProfile(p=>p?{...p,must_change_password:false}:p);setNewPassword("");setConfirmPassword("");notify("Senha atualizada com sucesso.");}catch(e:any){setError(e.message??"Não foi possível trocar a senha.");}finally{setSaving(false);}};
  const signOut=async()=>{await db.auth.signOut();setProfile(null);setSession(null);};
  const currentBranch=branches.find(b=>b.id===branchId);
  const visibleEmployees=employees.filter(e=>e.active||tab==="equipe");
  const weekEnd=shiftDate(weekStart,5);
  const weeklyRows=useMemo(()=>employees.map(employee=>{const rows=attendance.filter(a=>a.employee_id===employee.id&&a.status==="worked"&&a.work_date>=weekStart&&a.work_date<=weekEnd);const abs=attendance.filter(a=>a.employee_id===employee.id&&a.status==="absent"&&a.work_date>=weekStart&&a.work_date<=weekEnd).length;const extra=new Set(overtime.filter(o=>o.employee_id===employee.id&&o.work_date>=weekStart&&o.work_date<=weekEnd).map(o=>o.work_date)).size;const total=rows.reduce((sum:any,a:any)=>sum+(a.dailyRate??employee.dailyRate),0);const paid=payments.some(p=>p.employee_id===employee.id&&p.week_start===weekStart&&p.paid);return{employee,workedDays:rows.length,absences:abs,extraDays:extra,total,paid};}),[employees,attendance,overtime,payments,weekStart,weekEnd]);
  const dayRows=attendance.filter(a=>a.work_date===selectedDate&&a.status==="worked");
  const selectedWeekStart=mondayOf(selectedDate);const summary={worked:dayRows.filter(a=>a.status==="worked").length,absent:dayRows.filter(a=>a.status==="absent").length,extra:new Set(overtime.filter(o=>o.work_date>=selectedWeekStart&&o.work_date<=shiftDate(selectedWeekStart,6)).map(o=>o.employee_id)).size,amount:dayRows.filter(a=>a.status==="worked").reduce((s,a)=>s+((a as any).dailyRate??employees.find(e=>e.id===a.employee_id)?.dailyRate??0),0)};
  const weekTotal=weeklyRows.reduce((s,r)=>s+r.total,0);
  const weekHistory=useMemo(()=>{
    const starts=Array.from(new Set([
      ...attendance.map(a=>mondayOf(a.work_date)),
      ...payments.map(p=>p.week_start),
      weekStart
    ])).sort((a,b)=>b.localeCompare(a));
    return starts.map(start=>{
      const end=shiftDate(start,5);
      const rows=employees.map(employee=>{
        const worked=attendance.filter(a=>a.employee_id===employee.id&&a.status==="worked"&&a.work_date>=start&&a.work_date<=end);
        const absences=attendance.filter(a=>a.employee_id===employee.id&&a.status==="absent"&&a.work_date>=start&&a.work_date<=end).length;
        const extraDays=new Set(overtime.filter(o=>o.employee_id===employee.id&&o.work_date>=start&&o.work_date<=end).map(o=>o.work_date)).size;
        const total=worked.reduce((sum,a)=>sum+((a as any).dailyRate??employee.dailyRate),0);
        const payment=payments.find(p=>p.employee_id===employee.id&&p.week_start===start);
        return {employee,workedDays:worked.length,absences,extraDays,total,paid:!!payment?.paid};
      }).filter(r=>r.total>0||payments.some(p=>p.employee_id===r.employee.id&&p.week_start===start));
      const total=rows.reduce((sum,r)=>sum+r.total,0);
      const paidRows=rows.filter(r=>r.paid);
      const paidTotal=paidRows.reduce((sum,r)=>sum+r.total,0);
      const pendingRows=rows.filter(r=>r.total>0&&!r.paid);
      const status=rows.length>0&&pendingRows.length===0?"Pago":paidRows.length>0?"Pagamento parcial":"Pendente";
      return {start,end,rows,total,paidTotal,paidCount:paidRows.length,pendingCount:pendingRows.length,status};
    }).filter(w=>w.rows.length>0||w.start===weekStart);
  },[employees,attendance,overtime,payments,weekStart]);
  const paidTotal=weeklyRows.filter(r=>r.paid).reduce((s,r)=>s+r.total,0);
  const pending=weeklyRows.filter(r=>!r.paid&&r.total>0).length;

  const ensureWeekday=async(date:string)=>{
    const dow=new Date(date+"T12:00:00").getDay();
    if(dow===0||dow===6||date<todayISO())return;
    const alreadyHasRecords=attendance.some(a=>a.work_date===date);
    if(alreadyHasRecords)return;
    // Carry the previous day's team forward so the responsible only removes absentees.
    let previousDate=shiftDate(date,-1);
    if(new Date(previousDate+"T12:00:00").getDay()===0)previousDate=shiftDate(previousDate,-2);
    const previousTeam=attendance.filter(a=>a.work_date===previousDate&&a.status==="worked");
    if(!previousTeam.length)return;
    const rows=previousTeam.map(a=>({company_id:a.company_id,branch_id:a.branch_id,employee_id:a.employee_id,work_date:date,status:"worked",created_by:session.user.id}));
    const {error:e}=await db.from("attendance").upsert(rows,{onConflict:"employee_id,work_date",ignoreDuplicates:true});
    if(e){setError(e.message);return;}
    await loadData(profile!,branchId);
  };
  useEffect(()=>{if(profile&&branchId&&selectedDate>=todayISO())void ensureWeekday(selectedDate);},[selectedDate,profile,branchId,employees.length]);
  const addEmployee=async()=>{
    if(!employeeName.trim()||!profile||!branchId)return;if(profile.role==="admin"&&editingEmployee===null&& !branchId)return;
    setSaving(true);setError("");
    try{
      if(editingEmployee){
        const {error:e}=await db.from("employees").update({name:employeeName.trim(),pix_key:employeePixKey.trim()||null,pix_key_type:employeePixKey.trim()?employeePixType:null,pix_city:employeePixKey.trim()?employeePixCity.trim():null}).eq("id",editingEmployee.id);if(e)throw e;
        if(profile.role==="admin"){const {error:r}=await db.from("employee_rates").upsert({employee_id:editingEmployee.id,daily_rate:Number(employeeRate),effective_from:todayISO()},{onConflict:"employee_id"});if(r)throw r;}
      }else{
        const {data:e,error:insertError}=await db.from("employees").insert({company_id:profile.company_id,branch_id:profile.role==="admin"?branchId:profile.branch_id,name:employeeName.trim(),active:true,effective_from:todayISO(),pix_key:employeePixKey.trim()||null,pix_key_type:employeePixKey.trim()?employeePixType:null,pix_city:employeePixKey.trim()?normalizeReceiverBranch(currentBranch?.name??employeePixCity):null}).select("id").single();if(insertError)throw insertError;
        const {error:r}=await db.from("employee_rates").insert({employee_id:e.id,daily_rate:Number(employeeRate),effective_from:todayISO()});if(r)throw r;
      }
      setEmployeeName("");setEmployeePixKey("");setEmployeePixType("aleatoria");setEmployeePixCity("Juína");setEditingEmployee(null);await loadData(profile,branchId);notify("Funcionário salvo com sucesso.");
    }catch(e:any){setError(e.message??"Falha ao salvar funcionário.");}finally{setSaving(false);}
  };
  const toggleEmployee=async(emp:Employee)=>{if(emp.active&&!window.confirm(`Remover ${emp.name} da equipe? O funcionário ficará inativo, mas o histórico de diárias e pagamentos será preservado.`))return;const {error:e}=await db.from("employees").update({active:!emp.active}).eq("id",emp.id);if(e)setError(e.message);else{await loadData(profile!,branchId);notify(emp.active?"Funcionário removido da equipe. Histórico preservado.":"Funcionário reativado.");}};
  const addDaily=async()=>{
    if(!recordEmployee||!profile)return;
    const emp=employees.find(e=>e.id===recordEmployee);if(!emp)return;
    setSaving(true);setError("");
    try{
      const {data:existing,error:lookupError}=await db.from("attendance").select("id").eq("employee_id",emp.id).eq("work_date",selectedDate).maybeSingle();if(lookupError)throw lookupError;
      let attendanceId=existing?.id;
      if(attendanceId){const {error:updateError}=await db.from("attendance").update({status:"worked"}).eq("id",attendanceId);if(updateError)throw updateError;}
      else {const {data:created,error:insertError}=await db.from("attendance").insert({company_id:profile.company_id,branch_id:branchId,employee_id:emp.id,work_date:selectedDate,status:"worked",created_by:session.user.id}).select("id").single();if(insertError)throw insertError;attendanceId=created.id;}
      if(profile.role==="admin"){const {error:r}=await db.from("attendance_rates").upsert({attendance_id:attendanceId,daily_rate:emp.dailyRate},{onConflict:"attendance_id"});if(r)throw r;}
      await loadData(profile,branchId);setRecordEmployee("");notify("Diária registrada com sucesso.");
    }catch(e:any){setError(e.message??"Falha ao registrar diária.");}finally{setSaving(false);}
  };
  const removeRecord=async(a:Attendance)=>{const {error:e}=await db.from("attendance").delete().eq("id",a.id);if(e)setError(e.message);else await loadData(profile!,branchId);};
  const togglePaid=async(employeeId:string,start:string,paid:boolean)=>{if(!profile||profile.role!=="admin")return;const emp=employees.find(e=>e.id===employeeId);if(!emp)return;const {error:e}=await db.from("payments").upsert({company_id:profile.company_id,branch_id:branchId,employee_id:employeeId,week_start:start,paid,paid_at:paid?new Date().toISOString():null,updated_by:session.user.id},{onConflict:"employee_id,week_start"});if(e)setError(e.message);else{await loadData(profile,branchId);notify(paid?"Pagamento marcado como pago.":"Pagamento voltou para pendente.");}};
  const exportExcel=async(scope:"branch"|"all")=>{
    if(!profile||profile.role!=="admin")return;
    setSaving(true);setError("");
    try{
      const targetBranches=scope==="all"?branches:branches.filter(b=>b.id===branchId);
      if(!targetBranches.length)throw new Error("Nenhuma filial disponível para exportação.");
      const branchIds=targetBranches.map(b=>b.id);
      const end=shiftDate(weekStart,5);
      const [empRes,attRes,otRes,payRes]=await Promise.all([
        db.from("employees").select("id,company_id,branch_id,name,active,effective_from").eq("company_id",profile.company_id).in("branch_id",branchIds).order("name"),
        db.from("attendance").select("id,company_id,branch_id,employee_id,work_date,status").eq("company_id",profile.company_id).in("branch_id",branchIds).gte("work_date",weekStart).lte("work_date",end),
        db.from("overtime").select("id,employee_id,work_date,branch_id,company_id").eq("company_id",profile.company_id).in("branch_id",branchIds).gte("work_date",weekStart).lte("work_date",end),
        db.from("payments").select("employee_id,week_start,paid,paid_at,branch_id").eq("company_id",profile.company_id).in("branch_id",branchIds).eq("week_start",weekStart)
      ]);
      for(const result of [empRes,attRes,otRes,payRes])if(result.error)throw result.error;
      const employeeIds=(empRes.data??[]).map((e:any)=>e.id);
      const attendanceIds=(attRes.data??[]).map((a:any)=>a.id);
      const [rateRes,attRateRes]=await Promise.all([
        employeeIds.length?db.from("employee_rates").select("employee_id,daily_rate").in("employee_id",employeeIds):Promise.resolve({data:[],error:null} as any),
        attendanceIds.length?db.from("attendance_rates").select("attendance_id,daily_rate").in("attendance_id",attendanceIds):Promise.resolve({data:[],error:null} as any)
      ]);
      if(rateRes.error)throw rateRes.error;
      if(attRateRes.error)throw attRateRes.error;
      const rateMap=new Map<string,number>((rateRes.data??[]).map((r:any):[string,number]=>[String(r.employee_id),Number(r.daily_rate)]));
      const attendanceRateMap=new Map<string,number>((attRateRes.data??[]).map((r:any):[string,number]=>[String(r.attendance_id),Number(r.daily_rate)]));
      const details=(empRes.data??[]).map((employee:any)=>{
        const worked=(attRes.data??[]).filter((a:any)=>a.employee_id===employee.id&&a.status==="worked");
        const absences=(attRes.data??[]).filter((a:any)=>a.employee_id===employee.id&&a.status==="absent").length;
        const overtimeDays=new Set((otRes.data??[]).filter((o:any)=>o.employee_id===employee.id).map((o:any)=>o.work_date));
        const dailyRate=Number(rateMap.get(employee.id)??120);
        const total=worked.reduce((sum:number,a:any)=>sum+(attendanceRateMap.get(a.id)??dailyRate),0);
        const payment=(payRes.data??[]).find((p:any)=>p.employee_id===employee.id);
        return {employeeId:employee.id,branch:targetBranches.find(b=>b.id===employee.branch_id)?.name??"Filial",name:employee.name,workedDays:worked.length,absences,overtime:overtimeDays.size>0?"Sim":"Não",overtimeDays:overtimeDays.size,total,paid:!!payment?.paid,status:payment?.paid?"Pago":"Pendente"};
      }).filter((r:any)=>r.workedDays>0||r.absences>0||r.overtimeDays>0||(payRes.data??[]).some((p:any)=>p.employee_id===r.employeeId));
      const branchSummary=targetBranches.map(branch=>{
        const rows=details.filter((r:any)=>r.branch===branch.name);
        const total=rows.reduce((sum:number,r:any)=>sum+r.total,0);
        const paid=rows.filter((r:any)=>r.paid).reduce((sum:number,r:any)=>sum+r.total,0);
        return {Filial:branch.name,Funcionários:rows.length,Diárias:rows.reduce((s:number,r:any)=>s+r.workedDays,0),"Horas extras":rows.filter((r:any)=>r.overtime==="Sim").length,"Total da semana":total,"Total pago":paid,"Total pendente":total-paid};
      });
      const grandTotal=details.reduce((s:number,r:any)=>s+r.total,0);
      const grandPaid=details.filter((r:any)=>r.paid).reduce((s:number,r:any)=>s+r.total,0);
      const workbook=XLSX.utils.book_new();
      const summaryRows=[
        ["FECHAMENTO SEMANAL — RM"],
        ["Período",fmtDate(weekStart)+" a "+fmtDate(end)],
        ["Filiais",targetBranches.map(b=>b.name).join(" + ")],
        [],
        ["RESUMO POR FILIAL"],
        ["Filial","Funcionários","Diárias","Horas extras","Total da semana","Total pago","Total pendente"],
        ...branchSummary.map((r:any)=>[r.Filial,r.Funcionários,r.Diárias,r["Horas extras"],r["Total da semana"],r["Total pago"],r["Total pendente"]]),
        [],
        ["TOTAL GERAL","","","","",grandTotal,grandPaid],
        ["PENDENTE","","","","",grandTotal-grandPaid]
      ];
      const summarySheet=XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet["!cols"]=[{wch:25},{wch:16},{wch:12},{wch:15},{wch:20},{wch:18},{wch:20}];
      for(let row=7;row<7+branchSummary.length;row++)for(const col of ["E","F","G"])if(summarySheet[col+row])summarySheet[col+row].z='"R$" #,##0.00';
      for(const cell of ["F"+(8+branchSummary.length),"G"+(8+branchSummary.length),"F"+(9+branchSummary.length)])if(summarySheet[cell])summarySheet[cell].z='"R$" #,##0.00';
      XLSX.utils.book_append_sheet(workbook,summarySheet,"Resumo");
      const detailRows=[
        ["Funcionário","Filial","Diárias","Faltas","Hora extra","Dias com hora extra","Total","Pagamento"],
        ...details.map((r:any)=>[r.name,r.branch,r.workedDays,r.absences,r.overtime,r.overtimeDays,r.total,r.status])
      ];
      const detailSheet=XLSX.utils.aoa_to_sheet(detailRows);
      detailSheet["!cols"]=[{wch:28},{wch:18},{wch:12},{wch:12},{wch:14},{wch:22},{wch:17},{wch:15}];
      for(let i=2;i<=detailRows.length;i++)if(detailSheet["G"+i])detailSheet["G"+i].z='"R$" #,##0.00';
      XLSX.utils.book_append_sheet(workbook,detailSheet,"Funcionários");
      const filename="RM-fechamento-"+weekStart+(scope==="all"?"-duas-filiais":"-"+(targetBranches[0]?.name??"filial").toLowerCase().replace(/[^a-z0-9]+/g,"-"))+".xlsx";
      XLSX.writeFile(workbook,filename);
      notify("Planilha Excel gerada com sucesso.");
    }catch(e:any){setError(e.message??"Não foi possível gerar a planilha Excel.");}
    finally{setSaving(false);}
  };

  if(!isSupabaseConfigured)return <LoginShell><h1>Configuração pendente</h1><p>As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não foram encontradas nesta publicação da Vercel.</p></LoginShell>;
  if(!session)return <LoginShell><div className="login-brand login-brand-single"><div className="login-brand-stack"><div className="login-wordmark">RM</div><small>TERCEIRIZAÇÃO</small></div></div><div className="login-welcome"><h1>Bem-vindo de volta!</h1><p>Acesse sua conta para continuar.</p></div><form className="modal-form login-form" onSubmit={login}><label>Usuário<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Digite seu usuário" required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" required/></label>{error&&<p className="error-text">{error}</p>}<button className="btn-primary" disabled={loginBusy}>{loginBusy?"Entrando...":"Entrar"} <ArrowRight size={17}/></button></form>{loginBusy&&<LoadingTruck label="Autenticando acesso..." />}</LoginShell>;
  if(profile?.must_change_password)return <LoginShell><div className="login-brand login-brand-single"><div className="login-brand-stack"><div className="login-wordmark">RM</div><small>TERCEIRIZAÇÃO</small></div></div><div className="login-welcome"><h1>Crie sua nova senha</h1><p>Por segurança, altere a senha temporária antes de continuar.</p></div><form className="modal-form login-form" onSubmit={changePassword}><label>Nova senha<input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></label><label>Confirme a nova senha<input type="password" minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></label>{error&&<p className="error-text">{error}</p>}<button className="btn-primary" disabled={saving}>Salvar nova senha <ArrowRight size={17}/></button></form>{saving&&<LoadingTruck label="Atualizando senha..." />}</LoginShell>;
  const nav=[{id:"inicio",label:"Início",icon:LayoutDashboard},{id:"diarias",label:"Diárias",icon:CalendarCheck},...(profile?.role==="admin"?[{id:"equipe",label:"Equipe",icon:Users}]:[]),...(profile?[{id:"horas-extras",label:"Hora extra",icon:Clock3}]:[]),...(profile?.role==="admin"?[{id:"fechamento",label:"Fechamento",icon:Wallet}]:[])];
  const title=nav.find(n=>n.id===tab)?.label??"RM";
  if(loading&&!employees.length)return <LoginShell><div className="login-loading-brand"><div className="login-wordmark">RM</div><span>TERCEIRIZAÇÃO</span></div><LoadingTruck label="Carregando dados do sistema..." /></LoginShell>;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><img className="rm-logo" src="/rm-logo.svg" alt="RM Gestão" /><div><strong>RM</strong><small>GESTÃO RM</small></div></div>
      {profile?.role==="admin"?<label className="company-switch"><span>Filial</span><select value={branchId} onChange={e=>setBranchId(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>:<div className="company-switch"><b>{currentBranch?.name??"Sua filial"}</b></div>}
      <nav className="side-nav">{nav.map(item=><button key={item.id} className={tab===item.id?"nav-item active":"nav-item"} onClick={()=>setTab(item.id)}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><Activity size={18}/><b>Controle simples, dia a dia.</b><p>Seus registros ficam salvos na nuvem.</p></div><div className="profile"><div className="profile-avatar">{profile?.full_name?.slice(0,1)??"U"}</div><div><b>{profile?.full_name}</b><small>{profile?.role==="admin"?"Administrador":"Responsável da filial"}</small></div><button className="icon-button" onClick={signOut} title="Sair"><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><div className="mobile-brand"><img className="rm-logo" src="/rm-logo.svg" alt="RM Gestão" /><strong>RM</strong></div>{profile?.role==="admin"&&<label className="mobile-branch-switch" aria-label="Selecionar filial"><span>Filial</span><select value={branchId} onChange={e=>setBranchId(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}<div className="breadcrumb">Gestão RM <span>/</span> <b>{title}</b></div><div className="top-actions"><span className="today-label"><CalendarDays size={15}/>{new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"})}</span><button className="mobile-signout" onClick={signOut} title="Sair da conta" aria-label="Sair da conta"><LogOut size={16}/><span>Sair</span></button><div className="top-avatar">{profile?.full_name?.slice(0,1)}</div></div></header>
      <div className="page">
        {error&&<div className="error-banner"><AlertCircle size={17}/>{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}
        {tab==="inicio"&&<><PageHeading eyebrow="VISÃO GERAL" title={"Olá, "+profile?.full_name+"!"} description={"Acompanhe a rotina da filial "+(currentBranch?.name??"")+". "} action={<button className="btn-primary" onClick={()=>setTab("diarias")}><Plus size={17}/> Registrar diária</button>}/><div className="date-strip"><CalendarDays size={17}/><span>Resumo de</span><input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></div>{profile?.role==="admin"&&<div className="stats-grid admin-stats-grid"><StatCard label="Trabalharam" value={summary.worked} detail="Registros do dia" icon={UserRound} onClick={()=>setTab("diarias")}/><StatCard label="Hora extra" value={summary.extra} detail="Pessoas marcadas na semana" icon={Clock3} tone="blue" onClick={()=>setTab("horas-extras")}/><StatCard label="Valor do dia" value={money(summary.amount)} detail="Soma das diárias" icon={Wallet} tone="amber" onClick={()=>setTab("fechamento")}/></div>}</>}
        {tab==="diarias"&&<><PageHeading eyebrow="LANÇAMENTO" title="Diárias" description="A equipe do último dia útil é mantida como base. Retire da lista quem não trabalhou nesta data."/><div className="toolbar-card"><div className="date-picker-wrap"><CalendarDays size={18}/><label>Data do serviço<input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label></div><span className="muted-count">{dayRows.length} registros</span></div><section className="panel daily-entry"><div className="panel-head"><div><h2>Novo lançamento</h2><p>Selecione a pessoa que trabalhou.</p></div></div><div className="modal-form"><label><span>Funcionário</span><select value={recordEmployee} onChange={e=>setRecordEmployee(e.target.value)}><option value="">Selecione</option>{employees.filter(e=>e.active&&e.effective_from<=selectedDate).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><button className="btn-primary" onClick={addDaily} disabled={saving||!recordEmployee}><Plus size={16}/> Salvar diária</button></div></section><div className="section-title-row"><div><h2>Registros do dia</h2><p>Quem está nesta lista tem a diária registrada. Remova quem não trabalhou.</p></div></div><div className="attendance-list">{dayRows.map(a=>{const emp=employees.find(e=>e.id===a.employee_id);return <div className="attendance-card daily-record" key={a.id}><div className="person-info"><div className="person-avatar">{emp?.name.slice(0,1)??"?"}</div><div><b>{emp?.name??"Funcionário"}</b><small>{profile?.role==="admin"?money((a as any).dailyRate??emp?.dailyRate??120):"Presença registrada"}</small></div></div><div className="record-actions"><span className="extra-flag">Trabalhou</span><button className="icon-button danger-hover" onClick={()=>removeRecord(a)} aria-label="Excluir registro"><X size={17}/></button></div></div>})}</div></>}
        {tab==="equipe"&&profile?.role==="admin"&&<><PageHeading eyebrow="EQUIPE" title="Funcionários" description={profile.role==="admin"?"Cadastre pessoas e defina o valor da diária.":"Cadastre e consulte os funcionários da sua filial."}/><div className="panel daily-entry"><div className="modal-form"><label>Nome completo<input value={employeeName} onChange={e=>setEmployeeName(e.target.value)} placeholder="Nome do funcionário"/></label><label>Chave Pix<input value={employeePixKey} onChange={e=>setEmployeePixKey(e.target.value)} placeholder="CPF, telefone, e-mail ou chave aleatória"/></label><label>Tipo da chave<select value={employeePixType} onChange={e=>setEmployeePixType(e.target.value)}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="telefone">Telefone</option><option value="email">E-mail</option><option value="aleatoria">Aleatória</option></select></label><div className="branch-destination"><span>Filial do cadastro</span><strong>{currentBranch?.name??"Selecione a filial no topo"}</strong><small>O funcionário será salvo diretamente nesta filial.</small></div><label>Valor da diária<select value={employeeRate} onChange={e=>setEmployeeRate(e.target.value as "120"|"150")}><option value="120">R$ 120</option><option value="150">R$ 150</option></select></label><button className="btn-primary" onClick={addEmployee} disabled={saving||!employeeName.trim()}><Plus size={16}/> {editingEmployee?"Salvar alteração":"Cadastrar funcionário"}</button></div></div><div className="toolbar-card search-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar funcionário..."/></div><span className="muted-count">{employees.filter(e=>e.active).length} na equipe</span></div><div className="team-grid">{employees.filter(e=>e.active&&e.name.toLowerCase().includes(query.toLowerCase())).map(e=><div className="team-card" key={e.id}><div className="team-card-top"><div className="person-info"><div className="person-avatar">{e.name.slice(0,1)}</div><div><b>{e.name}</b><small>{money(e.dailyRate)} · {currentBranch?.name}</small></div></div>{<button className="icon-button" title="Editar funcionário e chave Pix" onClick={()=>{setEditingEmployee(e);setEmployeeName(e.name);setEmployeeRate(String(e.dailyRate) as "120"|"150");setEmployeePixKey(e.pix_key??"");setEmployeePixType(e.pix_key_type??"aleatoria");setEmployeePixCity(normalizeReceiverBranch(e.pix_city));}}><Settings2 size={18}/></button>}</div><div className="team-card-bottom"><span className={e.active?"status-pill success":"status-pill warning"}>{e.active?"Ativo":"Inativo"}</span>{profile.role==="admin"&&<button className="text-link danger-text" disabled={saving} onClick={()=>toggleEmployee(e)}>{e.active?"Excluir da equipe":"Reativar funcionário"}</button>}</div></div>)}</div></>}
        {tab==="horas-extras"&&profile&&<><PageHeading eyebrow="CONTROLE SEMANAL" title="Hora extra" description="Marque uma única vez os funcionários que fizeram hora extra nesta semana. Você pode adicionar ou retirar nomes até o fechamento."/><div className="toolbar-card"><div className="date-picker-wrap"><CalendarDays size={18}/><label>Semana de referência<input type="date" value={weekStart} onChange={e=>setWeekStart(mondayOf(e.target.value))}/></label></div><span className="muted-count">{fmtDate(weekStart)} – {fmtDate(shiftDate(weekStart,6))}</span></div><section className="panel daily-entry"><div className="panel-head"><div><h2>Funcionários com hora extra</h2><p>Selecione ou desmarque cada funcionário. O registro vale para a semana inteira.</p></div><span className="status-pill success">{overtime.filter(o=>o.work_date===weekStart).length} selecionados</span></div><div className="attendance-list">{employees.filter(e=>e.active).map(emp=>{const marked=overtime.some(o=>o.employee_id===emp.id&&o.work_date===weekStart);return <div className="attendance-card daily-record" key={emp.id}><div className="person-info"><div className="person-avatar">{emp.name.slice(0,1)}</div><div><b>{emp.name}</b><small>{currentBranch?.name??"Filial"}</small></div></div><button className={marked?"btn-paid":"btn-outline"} disabled={saving} onClick={async()=>{if(!profile)return;setSaving(true);setError("");try{if(marked){const {error:e}=await db.from("overtime").delete().eq("employee_id",emp.id).eq("work_date",weekStart);if(e)throw e;}else{const {error:e}=await db.from("overtime").insert({company_id:profile.company_id,branch_id:branchId,employee_id:emp.id,work_date:weekStart,created_by:session.user.id});if(e)throw e;}await loadData(profile,branchId);notify(marked?"Hora extra removida da semana.":"Hora extra registrada para a semana.");}catch(e:any){setError(e.message??"Não foi possível atualizar a hora extra.");}finally{setSaving(false);}}}>{marked?<><CheckCircle2 size={15}/> Marcado · Remover</>:<><Plus size={15}/> Marcar hora extra</>}</button></div>})}{employees.filter(e=>e.active).length===0&&<div className="empty-state"><b>Nenhum funcionário ativo</b><p>Cadastre funcionários na opção Equipe.</p></div>}</div></section></>}
        {tab==="fechamento"&&profile?.role==="admin"&&<><PageHeading eyebrow="PAGAMENTO SEMANAL" title="Controle de semanas" description="Acompanhe o que já foi pago e o que ainda está pendente." action={<div className="export-actions"><button className="btn-outline" disabled={saving} onClick={()=>void exportExcel("branch")}><Download size={16}/> Excel da filial</button><button className="btn-primary" disabled={saving} onClick={()=>void exportExcel("all")}><Download size={16}/> Excel das duas filiais</button></div>}/><div className="week-history-list">{weekHistory.map(week=>{const expanded=expandedWeekStart===week.start;return <section className="week-history-card" key={week.start}><button className="week-history-header" onClick={()=>setExpandedWeekStart(expanded?"":week.start)}><div className="week-history-heading"><b>{fmtDate(week.start)} – {fmtDate(week.end)}</b><small>Segunda a sábado · {week.rows.length} funcionários</small></div><div className="week-history-summary"><strong>{money(week.total)}</strong><span className={"week-history-status "+(week.status==="Pago"?"is-paid":week.status==="Pagamento parcial"?"is-partial":"is-pending")}>{week.status}</span></div><span className="week-history-chevron">{expanded?<X size={17}/>:<ArrowRight size={17}/>}</span></button><div className="week-history-meta"><span className="paid-meta">{week.paidCount} pagos</span><span className="pending-meta">{week.pendingCount} pendentes</span><span>Pago: {money(week.paidTotal)}</span></div>{expanded&&<div className="week-history-details"><div className="week-history-detail-head"><b>Funcionários da semana</b><span>Valor individual</span></div>{week.rows.map(r=><div className="week-employee-row" key={r.employee.id}><div className="week-employee-name"><b>{r.employee.name}</b><small>{r.workedDays} diárias · {r.absences} faltas · {r.extraDays} dias com hora extra</small></div><strong>{money(r.total)}</strong>{r.employee.pix_key&&r.total>0&&<button className="btn-outline small" onClick={()=>setPixPayment({name:r.employee.name,key:r.employee.pix_key!,amount:r.total,city:r.employee.pix_city??"Juína"})}><QrCode size={15}/> Pix</button>}<button className={r.paid?"btn-paid":"btn-mark-paid"} disabled={r.total===0} onClick={()=>togglePaid(r.employee.id,week.start,!r.paid)}>{r.paid?<><CheckCircle2 size={15}/> Pago</>:<><Check size={15}/> Marcar como pago</>}</button></div>)}{week.pendingCount===0&&week.rows.length>0&&<div className="week-all-paid"><CheckCircle2 size={17}/> Todos os funcionários desta semana estão pagos.</div>}</div>}</section>})}{weekHistory.length===0&&<div className="empty-state"><div className="empty-icon"><Wallet size={22}/></div><b>Nenhum fechamento encontrado</b><p>As semanas aparecerão aqui conforme os registros de trabalho forem feitos.</p></div>}</div></>}
      </div></main>
    {pixPayment&&<div className="modal-backdrop" onClick={()=>setPixPayment(null)}><section className="modal-card pix-modal" onClick={e=>e.stopPropagation()}><button className="icon-button modal-close" onClick={()=>setPixPayment(null)} aria-label="Fechar"><X size={18}/></button><div className="eyebrow">PAGAMENTO VIA PIX</div><h2>{pixPayment.name}</h2><div className="pix-amount">{money(pixPayment.amount)}</div><div className="pix-qr"><QRCodeSVG value={buildPixPayload(pixPayment.key,pixPayment.name,pixPayment.amount,pixPayment.city)} size={220} level="M" includeMargin/></div><p>Escaneie o QR Code no aplicativo do seu banco ou copie o código Pix.</p><button className="btn-primary" onClick={()=>{void navigator.clipboard.writeText(buildPixPayload(pixPayment.key,pixPayment.name,pixPayment.amount,pixPayment.city));notify("Código Pix copiado.");}}><Copy size={16}/> Copiar código Pix</button><small className="pix-key-label">Chave cadastrada: {pixPayment.key}</small></section></div>}
    <nav className="mobile-nav" style={{gridTemplateColumns:`repeat(${nav.length}, minmax(0, 1fr))`}}>{nav.map(item=><button key={item.id} className={tab===item.id?"mobile-nav-item active":"mobile-nav-item"} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
    {loading&&<div className="loading-overlay"><LoadingTruck label="Atualizando informações..." /></div>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
function LoginShell({children}:any){return <div className="login-screen"><div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/><div className="login-card">{children}</div></div>;}
function LoadingTruck({label="Carregando..."}:{label?:string}){return <div className="truck-loader" role="status" aria-live="polite"><div className="truck-road"><div className="truck-road-line"/><Truck className="truck-moving" size={42} strokeWidth={1.7}/></div><div className="truck-progress"><span/></div><span className="truck-loader-label">{label}</span></div>;}
function PageHeading({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action&&<div className="heading-action">{action}</div>}</div>;}
function StatCard({label,value,detail,icon:Icon,tone="green",onClick}:{label:string;value:string|number;detail:string;icon:any;tone?:string;onClick?:()=>void}){return <button type="button" className="stat-card stat-card-clickable" onClick={onClick} aria-label={label+" — abrir seção"}><div className={"stat-icon "+tone}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></button>;}