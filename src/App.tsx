import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, Check,
  CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Download, LayoutDashboard,
  Menu, Plus, Search, Settings2, Users, Wallet, X, UserRound, CalendarCheck,
  AlertCircle, ClipboardList, MoreHorizontal
} from "lucide-react";

type Employee = { id: string; name: string; role: string; dailyRate: number; hourlyRate: number; active: boolean };
type Attendance = { employeeId: string; date: string; status: "worked" | "absent" | "off"; dailyRate?: 120 | 150; note?: string };
type Overtime = { id: string; employeeId: string; date: string; hours: number; note: string };
type Payment = { employeeId: string; weekStart: string; paid: boolean; paidAt?: string };

const todayISO = () => {
  const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const shiftDate = (date: string, days: number) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + days); return dateFrom(d); };
const dateFrom = (d: Date) => { const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
const mondayOf = (date: string) => { const d = new Date(date + "T12:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return dateFrom(d); };
const fmtDate = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const uid = () => Math.random().toString(36).slice(2, 10);
const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function readStore<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem("diaria-gm-" + key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function App() {
  const [employees, setEmployees] = useState<Employee[]>(() => readStore("employees", []));
  const [attendance, setAttendance] = useState<Attendance[]>(() => readStore("attendance", []));
  const [overtime, setOvertime] = useState<Overtime[]>(() => readStore("overtime", []));
  const [payments, setPayments] = useState<Payment[]>(() => readStore("payments", []));
  const [tab, setTab] = useState("inicio");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [query, setQuery] = useState("");
  const [showEmployee, setShowEmployee] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { localStorage.setItem("diaria-gm-employees", JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem("diaria-gm-attendance", JSON.stringify(attendance)); }, [attendance]);
  useEffect(() => { localStorage.setItem("diaria-gm-overtime", JSON.stringify(overtime)); }, [overtime]);
  useEffect(() => { localStorage.setItem("diaria-gm-payments", JSON.stringify(payments)); }, [payments]);
  useEffect(() => {
    const demoNames = new Set(["Carlos Henrique","Marcos Oliveira","João Pedro","Ana Paula","Pedro Santos","Rafael Lima"]);
    setEmployees(old => old.filter(e => {
      const isDemo = demoNames.has(e.name);
      if (!isDemo) return true;
      const hasHistory = attendance.some(a => a.employeeId === e.id) || overtime.some(o => o.employeeId === e.id) || payments.some(p => p.employeeId === e.id);
      return hasHistory;
    }));
  }, []);

  const activeEmployees = employees.filter(e => e.active);
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const weekEnd = weekDays[6];
  const getStatus = (employeeId: string, date: string) => attendance.find(a => a.employeeId === employeeId && a.date === date)?.status;
  const setStatus = (employeeId: string, date: string, status: Attendance["status"]) => {
    setAttendance(old => [...old.filter(a => !(a.employeeId === employeeId && a.date === date)), { employeeId, date, status }]);
  };
  const summary = useMemo(() => {
    const todayRecords = attendance.filter(a => a.date === selectedDate);
    const worked = todayRecords.filter(a => a.status === "worked").length;
    const absent = todayRecords.filter(a => a.status === "absent").length;
    const extraPeople = overtime.filter(o => o.date === selectedDate).length;
    const dayValue = todayRecords.filter(a => a.status === "worked").reduce((sum, a) => { const person = employees.find(e => e.id === a.employeeId); return sum + (a.dailyRate ?? person?.dailyRate ?? 0); }, 0);
    return { worked, absent, unmarked: 0, extraPeople, dayValue };
  }, [attendance, overtime, selectedDate, employees]);

  const weeklyRows = useMemo(() => employees.map(employee => {
    const workedRecords = attendance.filter(a => a.employeeId === employee.id && a.status === "worked" && a.date >= weekStart && a.date <= weekEnd);
    const workedDays = workedRecords.length;
    const absences = attendance.filter(a => a.employeeId === employee.id && a.status === "absent" && a.date >= weekStart && a.date <= weekEnd).length;
    const extraDays = overtime.filter(o => o.employeeId === employee.id && o.date >= weekStart && o.date <= weekEnd).length;
    const total = workedRecords.reduce((sum, a) => sum + (a.dailyRate ?? employee.dailyRate), 0);
    const paid = payments.some(p => p.employeeId === employee.id && p.weekStart === weekStart && p.paid);
    return { employee, workedDays, absences, extraDays, total, paid };
  }), [employees, attendance, overtime, payments, weekStart, weekEnd]);
  const weekTotal = weeklyRows.reduce((s, r) => s + r.total, 0);
  const paidTotal = weeklyRows.filter(r => r.paid).reduce((s, r) => s + r.total, 0);
  const pendingCount = weeklyRows.filter(r => !r.paid && r.total > 0).length;

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const togglePaid = (employeeId: string, paid: boolean) => {
    setPayments(old => [...old.filter(p => !(p.employeeId === employeeId && p.weekStart === weekStart)), { employeeId, weekStart, paid, paidAt: paid ? todayISO() : undefined }]);
    notify(paid ? "Pagamento marcado como realizado" : "Pagamento voltou para pendente");
  };
  const exportCSV = () => {
    const rows = [["Funcionário", "Diárias", "Faltas", "Dias com hora extra", "Total", "Pagamento"],
      ...weeklyRows.map(r => [r.employee.name, String(r.workedDays), String(r.absences), String(r.extraDays), r.total.toFixed(2).replace(".", ","), r.paid ? "Pago" : "Pendente"])];
    const csv = "\uFEFF" + rows.map(row => row.map(v => '"' + v.replace(/"/g, '""') + '"').join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "fechamento-" + weekStart + ".csv"; a.click(); URL.revokeObjectURL(url);
  };
  const addEmployee = (data: Omit<Employee, "id" | "active">, id?: string) => {
    if (id) setEmployees(old => old.map(e => e.id === id ? { ...e, ...data } : e));
    else setEmployees(old => [...old, { ...data, id: uid(), active: true }]);
    setShowEmployee(false); setEditingEmployee(null); notify(id ? "Funcionário atualizado" : "Funcionário cadastrado");
  };
  const addDailyRecord = (employeeId: string, dailyRate: 120 | 150, date: string, hasOvertime: boolean) => {
    setAttendance(old => [...old.filter(a => !(a.employeeId === employeeId && a.date === date)), { employeeId, date, status: "worked", dailyRate }]);
    setOvertime(old => [...old.filter(o => !(o.employeeId === employeeId && o.date === date)), ...(hasOvertime ? [{ id: uid(), employeeId, date, hours: 1, note: "Passou do horário de saída" }] : [])]);
    notify("Diária registrada");
  };

  const nav = [
    { id: "inicio", label: "Início", icon: LayoutDashboard },
    { id: "diarias", label: "Diárias", icon: CalendarCheck },
    { id: "equipe", label: "Equipe", icon: Users },
    { id: "fechamento", label: "Fechamento", icon: Wallet },
  ];
  const title = nav.find(n => n.id === tab)?.label ?? "Diária GM";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">GM</div><div><strong>GM</strong><small>GESTÃO DE EQUIPE</small></div></div>
      <div className="company-switch"><div className="company-avatar">G</div><div><b>GM</b><small>Gestão de equipe</small></div><ChevronDown size={16}/></div>
      <nav className="side-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => setTab(item.id)}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Activity size={18}/></div><b>Controle simples, dia a dia.</b><p>Registre a equipe e feche a semana sem complicação.</p></div><div className="profile"><div className="profile-avatar">GM</div><div><b>Administrador</b><small>Gestor da empresa</small></div><MoreHorizontal size={18}/></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark">GM</div><strong>GM</strong></div><div className="breadcrumb">Gestão da equipe <span>/</span> <b>{title}</b></div><div className="top-actions"><span className="today-label"><CalendarDays size={15}/>{new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"})}</span><div className="top-avatar">GM</div></div></header>
      <div className="page">
        {tab === "inicio" && <Dashboard employees={activeEmployees} summary={summary} weekTotal={weekTotal} pendingCount={pendingCount} setTab={setTab} selectedDate={selectedDate} setSelectedDate={setSelectedDate} weeklyRows={weeklyRows}/>}
        {tab === "diarias" && <DailyPage employees={employees} attendance={attendance} overtime={overtime} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAdd={addDailyRecord} onDelete={(employeeId: string, date: string) => { setAttendance(old => old.filter(a => !(a.employeeId === employeeId && a.date === date))); setOvertime(old => old.filter(o => !(o.employeeId === employeeId && o.date === date))); notify("Registro do dia removido"); }}/>} 
        {tab === "equipe" && <TeamPage employees={employees} query={query} setQuery={setQuery} onAdd={() => {setEditingEmployee(null);setShowEmployee(true);}} onEdit={(e: Employee) => {setEditingEmployee(e);setShowEmployee(true);}} onToggle={(id: string) => setEmployees((old: Employee[]) => old.map((e: Employee) => e.id === id ? {...e,active:!e.active}:e))}/>}
        {tab === "fechamento" && <ClosingPage rows={weeklyRows} weekStart={weekStart} setWeekStart={setWeekStart} weekEnd={weekEnd} total={weekTotal} paidTotal={paidTotal} pendingCount={pendingCount} onTogglePaid={togglePaid} onExport={exportCSV}/>}
      </div>
    </main>
    <nav className="mobile-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setTab(item.id)}><item.icon size={20}/><span>{item.label === "Horas extras" ? "Extras" : item.label}</span></button>)}</nav>
    {showEmployee && <EmployeeModal employee={editingEmployee} onClose={() => {setShowEmployee(false);setEditingEmployee(null);}} onSave={addEmployee}/>}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
function StatCard({ label, value, detail, icon: Icon, tone = "green" }: { label: string; value: string | number; detail: string; icon: React.ElementType; tone?: string }) {
  return <div className="stat-card"><div className={"stat-icon " + tone}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}
function Dashboard({ employees, summary, weekTotal, pendingCount, setTab, selectedDate, setSelectedDate, weeklyRows }: any) {
  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
  return <>
    <PageHeading eyebrow="VISÃO GERAL" title="Bom dia! 👋" description="Acompanhe a rotina e os números da sua equipe." action={<button className="btn-primary" onClick={() => setTab("diarias")}><Plus size={17}/> Registrar diária</button>}/>
    <div className="date-strip"><CalendarDays size={17}/><span>Resumo de</span><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}/><span className="date-long">{dateLabel}</span></div>
    <div className="stats-grid">
      <StatCard label="Trabalharam hoje" value={summary.worked} detail={"de " + employees.length + " funcionários ativos"} icon={UserRound} tone="green"/>
      <StatCard label="Faltas registradas" value={summary.absent} detail="Ausências neste dia" icon={AlertCircle} tone="red"/>
      <StatCard label="Com hora extra" value={summary.extraPeople} detail="Passaram do horário de saída" icon={Clock3} tone="blue"/>
      <StatCard label="Valor lançado hoje" value={money(summary.dayValue)} detail="Diárias + horas extras" icon={Wallet} tone="amber"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel daily-focus"><div className="panel-head"><div><h2>Resumo da semana</h2><p>Prévia do fechamento semanal</p></div><button className="text-link" onClick={() => setTab("fechamento")}>Ver fechamento <ArrowRight size={15}/></button></div>
        <div className="weekly-highlight"><div><span>Valor previsto da equipe</span><strong>{money(weekTotal)}</strong></div><div className="highlight-icon"><Wallet size={22}/></div></div>
        <div className="mini-metrics"><div><b>{weeklyRows.reduce((s: number,r: any)=>s+r.workedDays,0)}</b><span>Diárias registradas</span></div><div><b>{weeklyRows.reduce((s: number,r: any)=>s+r.extraDays,0)}</b><span>Dias com extra</span></div><div><b>{pendingCount}</b><span>Pagamentos pendentes</span></div></div>
      </section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Acesso rápido</h2><p>O que você precisa fazer?</p></div></div><button className="quick-action" onClick={() => setTab("diarias")}><span className="quick-icon green"><CalendarCheck size={19}/></span><span><b>Conferir diárias do dia</b><small>Marcar presença ou falta</small></span><ArrowRight size={17}/></button><button className="quick-action" onClick={() => setTab("diarias")}><span className="quick-icon blue"><Clock3 size={19}/></span><span><b>Adicionar diária e extra</b><small>Faça os dois lançamentos juntos</small></span><ArrowRight size={17}/></button><button className="quick-action" onClick={() => setTab("equipe")}><span className="quick-icon amber"><Users size={19}/></span><span><b>Administrar equipe</b><small>Adicionar ou editar funcionários</small></span><ArrowRight size={17}/></button></section>
    </div>
    <section className="panel attention-panel"><div className="panel-head"><div><h2>Conferência do dia</h2><p>Um resumo rápido para não deixar ninguém sem lançamento.</p></div><button className="btn-outline small" onClick={() => setTab("diarias")}>Abrir diárias</button></div><div className="attention-row"><div className="attention-symbol"><AlertCircle size={18}/></div><div><b>{summary.worked} pessoas lançadas neste dia</b><small>O sistema considera somente quem você adicionou à diária da data selecionada.</small></div><span className="status-pill success">Atualizado</span></div></section>
  </>;
}

function DailyPage({ employees, attendance, overtime, selectedDate, setSelectedDate, onAdd, onDelete }: any) {
  const [employeeId,setEmployeeId]=useState("");
  const [dailyRate,setDailyRate]=useState<"120"|"150">("120");
  const [hasOvertime,setHasOvertime]=useState(false);
  const activeEmployees=employees.filter((e:Employee)=>e.active);
  const dayRows=attendance.filter((a:Attendance)=>a.date===selectedDate&&a.status==="worked");
  const extraCount=overtime.filter((o:Overtime)=>o.date===selectedDate).length;
  const getPerson=(id:string)=>employees.find((e:Employee)=>e.id===id);
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(!employeeId)return;onAdd(employeeId,Number(dailyRate) as 120|150,selectedDate,hasOvertime);setEmployeeId("");setDailyRate("120");setHasOvertime(false);};
  return <>
    <PageHeading eyebrow="LANÇAMENTO" title="Diárias" description="Selecione a pessoa, escolha o valor e marque se passou do horário."/>
    <div className="toolbar-card"><div className="date-picker-wrap"><CalendarDays size={18}/><label>Data do serviço<input type="date" value={selectedDate} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setSelectedDate(e.target.value)}/></label></div><div className="toolbar-counts"><span className="count-green">{dayRows.length} lançadas</span><span>{extraCount} com hora extra</span></div></div>
    <section className="panel daily-entry"><div className="panel-head"><div><h2>Novo lançamento</h2><p>Um registro por pessoa em cada dia.</p></div></div>
      {activeEmployees.length===0?<div className="empty-inline"><Users size={19}/><span>Cadastre os funcionários na aba Equipe para começar.</span></div>:
      <form className="modal-form" onSubmit={submit}>
        <label><span>Funcionário</span><select required value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Selecione uma pessoa</option>{activeEmployees.map((e:Employee)=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <div className="rate-options" role="group" aria-label="Valor da diária">
          <button type="button" className={dailyRate==="120"?"rate-option selected":"rate-option"} onClick={()=>setDailyRate("120")}><small>Diária</small><b>R$ 120</b></button>
          <button type="button" className={dailyRate==="150"?"rate-option selected":"rate-option"} onClick={()=>setDailyRate("150")}><small>Cargueiro</small><b>R$ 150</b></button>
        </div>
        <label className="overtime-toggle"><input type="checkbox" checked={hasOvertime} onChange={e=>setHasOvertime(e.target.checked)}/><span><b>Fez hora extra</b><small>Passou do horário de saída</small></span></label>
        <div className="modal-actions"><button className="btn-primary" type="submit"><Plus size={16}/> Salvar diária</button></div>
      </form>}
    </section>
    <div className="section-title-row"><div><h2>Lançamentos do dia</h2><p>Diárias e ocorrências de hora extra.</p></div><span className="muted-count">{dayRows.length} pessoas</span></div>
    {dayRows.length===0?<div className="empty-state"><div className="empty-icon"><Users size={25}/></div><b>Nenhum lançamento nesta data</b><p>Adicione as pessoas que trabalharam.</p></div>:
    <div className="attendance-list">{dayRows.map((a:Attendance)=>{const person=getPerson(a.employeeId);const rate=a.dailyRate??person?.dailyRate??120;const extra=overtime.some((o:Overtime)=>o.employeeId===a.employeeId&&o.date===selectedDate);return <div className="attendance-card daily-record" key={a.employeeId}><div className="person-info"><div className="person-avatar">{(person?.name??"?").split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{person?.name??"Funcionário não encontrado"}</b><small>{money(rate)}</small></div></div><div className="record-actions"><span className={extra?"extra-flag active":"extra-flag"}>{extra?"Com hora extra":"Sem hora extra"}</span><button className="icon-button danger-hover" aria-label="Remover lançamento do dia" onClick={()=>onDelete(a.employeeId,selectedDate)}><X size={17}/></button></div></div>})}</div>}
  </>;
}

function OvertimePage({ overtime, employees, onAdd, onDelete }: any) {
  const [filterDate,setFilterDate] = useState(todayISO());
  const list = overtime.filter((o: Overtime)=>o.date===filterDate).sort((a: Overtime,b: Overtime)=>b.date.localeCompare(a.date));
  const total = list.reduce((s: number,o: Overtime)=>s+o.hours,0);
  const name = (id:string)=>employees.find((e:Employee)=>e.id===id)?.name ?? "Funcionário inativo";
  return <>
    <PageHeading eyebrow="HORAS EXTRAS" title="Horas extras" description="Registre as horas feitas por cada pessoa em cada dia." action={<button className="btn-primary" onClick={onAdd}><Plus size={17}/> Lançar horas</button>}/>
    <div className="stats-grid two-stats"><StatCard label="Horas no dia" value={total.toLocaleString("pt-BR")+"h"} detail="Total lançado na data" icon={Clock3} tone="blue"/><StatCard label="Lançamentos" value={list.length} detail="Registros neste dia" icon={ClipboardList} tone="green"/></div>
    <div className="toolbar-card"><div className="date-picker-wrap"><CalendarDays size={18}/><label>Filtrar por dia<input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}/></label></div></div>
    <div className="section-title-row"><div><h2>Lançamentos do dia</h2><p>As horas serão somadas no fechamento semanal.</p></div></div>
    {list.length===0?<div className="empty-state"><div className="empty-icon"><Clock3 size={25}/></div><b>Nenhuma hora extra neste dia</b><p>Quando houver horas extras, registre por aqui.</p><button className="btn-outline" onClick={onAdd}><Plus size={16}/> Adicionar lançamento</button></div>:<div className="panel table-panel"><div className="table-head"><span>FUNCIONÁRIO</span><span>HORAS</span><span>OBSERVAÇÃO</span><span></span></div>{list.map((o:Overtime)=><div className="table-row" key={o.id}><b>{name(o.employeeId)}</b><strong className="hours-value">{o.hours.toLocaleString("pt-BR")}h</strong><span className="table-note">{o.note||"—"}</span><button className="icon-button danger-hover" onClick={()=>onDelete(o.id)} aria-label="Excluir lançamento"><X size={17}/></button></div>)}</div>}
  </>;
}

function TeamPage({ employees, query, setQuery, onAdd, onEdit, onToggle }: any) {
  const filtered = employees.filter((e:Employee)=>e.name.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading eyebrow="EQUIPE" title="Funcionários" description="Cadastre e gerencie quem pode receber lançamentos." action={<button className="btn-primary" onClick={onAdd}><Plus size={17}/> Adicionar pessoa</button>}/>
    <div className="toolbar-card search-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar funcionário..."/></div><span className="muted-count">{employees.filter((e:Employee)=>e.active).length} ativos</span></div>
    <div className="team-grid">{filtered.map((e:Employee)=><div className="team-card" key={e.id}><div className="team-card-top"><div className="person-info"><div className="person-avatar">{e.name.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{e.name}</b><small>{e.role}</small></div></div><button className="icon-button" onClick={()=>onEdit(e)} aria-label="Editar funcionário"><Settings2 size={18}/></button></div><div className="team-card-bottom"><span className={e.active?"status-pill success":"status-pill warning"}>{e.active?"Ativo":"Inativo"}</span><button className="text-link" onClick={()=>onToggle(e.id)}>{e.active?"Remover da equipe":"Adicionar à equipe"}</button></div></div>)}</div>
    {filtered.length===0&&<div className="empty-state"><b>Nenhum funcionário encontrado</b><p>Tente outro nome ou cadastre uma pessoa.</p></div>}
  </>;
}

function ClosingPage({ rows, weekStart, setWeekStart, weekEnd, total, paidTotal, pendingCount, onTogglePaid, onExport }: any) {
  return <>
    <PageHeading eyebrow="PAGAMENTO SEMANAL" title="Fechamento da semana" description="Confira as diárias e horas extras, depois marque quem já recebeu." action={<button className="btn-outline" onClick={onExport}><Download size={17}/> Exportar CSV</button>}/>
    <div className="week-selector"><button className="icon-button" onClick={()=>setWeekStart(shiftDate(weekStart,-7))}><ArrowLeft size={18}/></button><div><b>{fmtDate(weekStart)} – {fmtDate(weekEnd)}</b><small>Período de segunda a domingo</small></div><button className="icon-button" onClick={()=>setWeekStart(shiftDate(weekStart,7))}><ArrowRight size={18}/></button><button className="today-button" onClick={()=>setWeekStart(mondayOf(todayISO()))}>Semana atual</button></div>
    <div className="stats-grid closing-stats"><StatCard label="Total previsto" value={money(total)} detail="Diárias + horas extras" icon={CircleDollarSign} tone="green"/><StatCard label="Já marcado como pago" value={money(paidTotal)} detail="Pagamentos confirmados" icon={CheckCircle2} tone="blue"/><StatCard label="Pendentes" value={pendingCount} detail="Pessoas aguardando pagamento" icon={AlertCircle} tone="amber"/></div>
    <div className="section-title-row"><div><h2>Resumo por funcionário</h2><p>O total considera as diárias registradas. Hora extra aparece apenas como informação.</p></div></div>
    <div className="closing-list">{rows.map((r:any)=><div className="closing-card" key={r.employee.id}><div className="closing-main"><div className="person-avatar">{r.employee.name.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}</div><div className="closing-name"><b>{r.employee.name}</b><small>{r.workedDays} diárias · {r.absences} faltas · {r.extraDays} dias com extra</small></div><div className="closing-total"><b>{money(r.total)}</b><small>{r.paid?"Pagamento realizado":"Aguardando pagamento"}</small></div></div><div className="closing-bottom"><span className={r.paid?"status-pill success":"status-pill warning"}>{r.paid?"Pago":"Pendente"}</span><button className={r.paid?"btn-paid":"btn-mark-paid"} disabled={r.total===0} onClick={()=>onTogglePaid(r.employee.id,!r.paid)}>{r.paid?<><CheckCircle2 size={15}/> Pago</>:<><Check size={15}/> Marcar como pago</>}</button></div></div>)}</div>
    <div className="closing-total-bar"><span>Total da semana</span><b>{money(total)}</b></div>
    <div className="tip-box"><AlertCircle size={17}/><span>Hora extra é apenas um registro de que a pessoa passou do horário de saída. Não altera o valor da diária.</span></div>
  </>;
}

function EmployeeModal({ employee, onClose, onSave }: any) {
  const [name,setName]=useState(employee?.name??"");
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(!name.trim())return;onSave({name:name.trim(),role:employee?.role??"Funcionário",dailyRate:employee?.dailyRate??120,hourlyRate:employee?.hourlyRate??0},employee?.id);};
  return <Modal title={employee?"Editar nome":"Adicionar pessoa"} onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do funcionário"/></label><div className="modal-actions"><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button className="btn-primary" type="submit"><Check size={16}/> Salvar</button></div></form></Modal>;
}
function OvertimeModal({ employees, selectedDate, onClose, onSave }: any) {
  const [employeeId,setEmployeeId]=useState(employees[0]?.id??""); const [date,setDate]=useState(selectedDate); const [hours,setHours]=useState("1"); const [note,setNote]=useState("");
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(employeeId&&Number(hours)>0)onSave(employeeId,date,Number(hours),note.trim());};
  return <Modal title="Registrar hora extra" onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Funcionário<select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}>{employees.map((e:Employee)=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label><div className="form-grid"><label>Data<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Quantidade de horas<input type="number" min="0.25" step="0.25" required value={hours} onChange={e=>setHours(e.target.value)}/></label></div><label>Observação (opcional)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex.: ficou até mais tarde"/></label><div className="modal-actions"><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button className="btn-primary" type="submit"><Check size={16}/> Salvar lançamento</button></div></form></Modal>;
}
function Modal({ title, children, onClose }: any) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }

export default App;