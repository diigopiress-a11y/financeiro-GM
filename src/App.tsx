import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, Check,
  CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Download, LayoutDashboard,
  Menu, Plus, Search, Settings2, Users, Wallet, X, UserRound, CalendarCheck,
  AlertCircle, ClipboardList, MoreHorizontal
} from "lucide-react";

type Employee = { id: string; name: string; role: string; dailyRate: number; hourlyRate: number; active: boolean };
type Attendance = { employeeId: string; date: string; status: "worked" | "absent" | "off"; note?: string };
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
const seedEmployees: Employee[] = [
  { id: "e1", name: "Carlos Henrique", role: "Operador", dailyRate: 150, hourlyRate: 20, active: true },
  { id: "e2", name: "Marcos Oliveira", role: "Auxiliar", dailyRate: 130, hourlyRate: 18, active: true },
  { id: "e3", name: "João Pedro", role: "Motorista", dailyRate: 170, hourlyRate: 22, active: true },
  { id: "e4", name: "Ana Paula", role: "Ajudante", dailyRate: 130, hourlyRate: 18, active: true },
  { id: "e5", name: "Pedro Santos", role: "Operador", dailyRate: 150, hourlyRate: 20, active: true },
  { id: "e6", name: "Rafael Lima", role: "Auxiliar", dailyRate: 130, hourlyRate: 18, active: true },
];

function readStore<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem("diaria-gm-" + key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function App() {
  const [employees, setEmployees] = useState<Employee[]>(() => readStore("employees", seedEmployees));
  const [attendance, setAttendance] = useState<Attendance[]>(() => readStore("attendance", []));
  const [overtime, setOvertime] = useState<Overtime[]>(() => readStore("overtime", []));
  const [payments, setPayments] = useState<Payment[]>(() => readStore("payments", []));
  const [tab, setTab] = useState("inicio");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [query, setQuery] = useState("");
  const [showEmployee, setShowEmployee] = useState(false);
  const [showOvertime, setShowOvertime] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { localStorage.setItem("diaria-gm-employees", JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem("diaria-gm-attendance", JSON.stringify(attendance)); }, [attendance]);
  useEffect(() => { localStorage.setItem("diaria-gm-overtime", JSON.stringify(overtime)); }, [overtime]);
  useEffect(() => { localStorage.setItem("diaria-gm-payments", JSON.stringify(payments)); }, [payments]);

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
    const unmarked = activeEmployees.length - todayRecords.length;
    const hours = overtime.filter(o => o.date === selectedDate).reduce((sum, o) => sum + o.hours, 0);
    return { worked, absent, unmarked: Math.max(0, unmarked), hours };
  }, [attendance, overtime, selectedDate, activeEmployees.length]);

  const weeklyRows = useMemo(() => activeEmployees.map(employee => {
    const workedDays = attendance.filter(a => a.employeeId === employee.id && a.status === "worked" && a.date >= weekStart && a.date <= weekEnd).length;
    const absences = attendance.filter(a => a.employeeId === employee.id && a.status === "absent" && a.date >= weekStart && a.date <= weekEnd).length;
    const extraHours = overtime.filter(o => o.employeeId === employee.id && o.date >= weekStart && o.date <= weekEnd).reduce((s, o) => s + o.hours, 0);
    const total = workedDays * employee.dailyRate + extraHours * employee.hourlyRate;
    const paid = payments.some(p => p.employeeId === employee.id && p.weekStart === weekStart && p.paid);
    return { employee, workedDays, absences, extraHours, total, paid };
  }), [activeEmployees, attendance, overtime, payments, weekStart, weekEnd]);
  const weekTotal = weeklyRows.reduce((s, r) => s + r.total, 0);
  const paidTotal = weeklyRows.filter(r => r.paid).reduce((s, r) => s + r.total, 0);
  const pendingCount = weeklyRows.filter(r => !r.paid && r.total > 0).length;

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const togglePaid = (employeeId: string, paid: boolean) => {
    setPayments(old => [...old.filter(p => !(p.employeeId === employeeId && p.weekStart === weekStart)), { employeeId, weekStart, paid, paidAt: paid ? todayISO() : undefined }]);
    notify(paid ? "Pagamento marcado como realizado" : "Pagamento voltou para pendente");
  };
  const exportCSV = () => {
    const rows = [["Funcionário", "Diárias", "Faltas", "Horas extras", "Valor diária", "Valor hora extra", "Total", "Pagamento"],
      ...weeklyRows.map(r => [r.employee.name, String(r.workedDays), String(r.absences), String(r.extraHours).replace(".", ","), String(r.employee.dailyRate), String(r.employee.hourlyRate), r.total.toFixed(2).replace(".", ","), r.paid ? "Pago" : "Pendente"])];
    const csv = "\uFEFF" + rows.map(row => row.map(v => '"' + v.replace(/"/g, '""') + '"').join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "fechamento-" + weekStart + ".csv"; a.click(); URL.revokeObjectURL(url);
  };
  const addEmployee = (data: Omit<Employee, "id" | "active">, id?: string) => {
    if (id) setEmployees(old => old.map(e => e.id === id ? { ...e, ...data } : e));
    else setEmployees(old => [...old, { ...data, id: uid(), active: true }]);
    setShowEmployee(false); setEditingEmployee(null); notify(id ? "Funcionário atualizado" : "Funcionário cadastrado");
  };
  const addOvertime = (employeeId: string, date: string, hours: number, note: string) => {
    setOvertime(old => [...old, { id: uid(), employeeId, date, hours, note }]);
    setShowOvertime(false); notify("Hora extra registrada");
  };

  const nav = [
    { id: "inicio", label: "Início", icon: LayoutDashboard },
    { id: "diarias", label: "Diárias", icon: CalendarCheck },
    { id: "extras", label: "Horas extras", icon: Clock3 },
    { id: "equipe", label: "Equipe", icon: Users },
    { id: "fechamento", label: "Fechamento", icon: Wallet },
  ];
  const title = nav.find(n => n.id === tab)?.label ?? "Diária GM";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">GM</div><div><strong>diária<span>gm</span></strong><small>GESTÃO DE EQUIPE</small></div></div>
      <div className="company-switch"><div className="company-avatar">G</div><div><b>Grupo Modelo</b><small>Ambiente de demonstração</small></div><ChevronDown size={16}/></div>
      <nav className="side-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => setTab(item.id)}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Activity size={18}/></div><b>Controle simples, dia a dia.</b><p>Registre a equipe e feche a semana sem complicação.</p></div><div className="profile"><div className="profile-avatar">GM</div><div><b>Administrador</b><small>Gestor da empresa</small></div><MoreHorizontal size={18}/></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark">GM</div><strong>diária<span>gm</span></strong></div><div className="breadcrumb">Gestão da equipe <span>/</span> <b>{title}</b></div><div className="top-actions"><span className="today-label"><CalendarDays size={15}/>{new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"})}</span><div className="top-avatar">GM</div></div></header>
      <div className="page">
        {tab === "inicio" && <Dashboard employees={activeEmployees} summary={summary} weekTotal={weekTotal} pendingCount={pendingCount} setTab={setTab} selectedDate={selectedDate} setSelectedDate={setSelectedDate} weeklyRows={weeklyRows}/>}
        {tab === "diarias" && <DailyPage employees={activeEmployees} selectedDate={selectedDate} setSelectedDate={setSelectedDate} getStatus={getStatus} setStatus={setStatus} notify={notify}/>}
        {tab === "extras" && <OvertimePage overtime={overtime} employees={activeEmployees} onAdd={() => setShowOvertime(true)} onDelete={(id: string) => setOvertime(old => old.filter(o => o.id !== id))}/>}
        {tab === "equipe" && <TeamPage employees={employees} query={query} setQuery={setQuery} onAdd={() => {setEditingEmployee(null);setShowEmployee(true);}} onEdit={(e: Employee) => {setEditingEmployee(e);setShowEmployee(true);}} onToggle={(id: string) => setEmployees(old => old.map(e => e.id === id ? {...e,active:!e.active}:e))}/>}
        {tab === "fechamento" && <ClosingPage rows={weeklyRows} weekStart={weekStart} setWeekStart={setWeekStart} weekEnd={weekEnd} total={weekTotal} paidTotal={paidTotal} pendingCount={pendingCount} onTogglePaid={togglePaid} onExport={exportCSV}/>}
      </div>
    </main>
    <nav className="mobile-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setTab(item.id)}><item.icon size={20}/><span>{item.label === "Horas extras" ? "Extras" : item.label}</span></button>)}</nav>
    {showEmployee && <EmployeeModal employee={editingEmployee} onClose={() => {setShowEmployee(false);setEditingEmployee(null);}} onSave={addEmployee}/>}
    {showOvertime && <OvertimeModal employees={activeEmployees} selectedDate={selectedDate} onClose={() => setShowOvertime(false)} onSave={addOvertime}/>}
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
      <StatCard label="Horas extras hoje" value={summary.hours.toLocaleString("pt-BR") + "h"} detail="Lançadas pela equipe" icon={Clock3} tone="blue"/>
      <StatCard label="Sem registro" value={summary.unmarked} detail="Aguardando conferência" icon={ClipboardList} tone="amber"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel daily-focus"><div className="panel-head"><div><h2>Resumo da semana</h2><p>Prévia do fechamento semanal</p></div><button className="text-link" onClick={() => setTab("fechamento")}>Ver fechamento <ArrowRight size={15}/></button></div>
        <div className="weekly-highlight"><div><span>Valor previsto da equipe</span><strong>{money(weekTotal)}</strong></div><div className="highlight-icon"><Wallet size={22}/></div></div>
        <div className="mini-metrics"><div><b>{weeklyRows.reduce((s: number,r: any)=>s+r.workedDays,0)}</b><span>Diárias registradas</span></div><div><b>{weeklyRows.reduce((s: number,r: any)=>s+r.extraHours,0).toLocaleString("pt-BR")}h</b><span>Horas extras</span></div><div><b>{pendingCount}</b><span>Pagamentos pendentes</span></div></div>
      </section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Acesso rápido</h2><p>O que você precisa fazer?</p></div></div><button className="quick-action" onClick={() => setTab("diarias")}><span className="quick-icon green"><CalendarCheck size={19}/></span><span><b>Conferir diárias do dia</b><small>Marcar presença ou falta</small></span><ArrowRight size={17}/></button><button className="quick-action" onClick={() => setTab("extras")}><span className="quick-icon blue"><Clock3 size={19}/></span><span><b>Lançar hora extra</b><small>Registrar horas por funcionário</small></span><ArrowRight size={17}/></button><button className="quick-action" onClick={() => setTab("equipe")}><span className="quick-icon amber"><Users size={19}/></span><span><b>Administrar equipe</b><small>Adicionar ou editar funcionários</small></span><ArrowRight size={17}/></button></section>
    </div>
    <section className="panel attention-panel"><div className="panel-head"><div><h2>Conferência do dia</h2><p>Um resumo rápido para não deixar ninguém sem lançamento.</p></div><button className="btn-outline small" onClick={() => setTab("diarias")}>Abrir diárias</button></div><div className="attention-row"><div className="attention-symbol"><AlertCircle size={18}/></div><div><b>{summary.unmarked} {summary.unmarked === 1 ? "pessoa sem registro" : "pessoas sem registro"}</b><small>Confira se todos os funcionários ativos tiveram a situação lançada.</small></div><span className="status-pill warning">Conferir</span></div></section>
  </>;
}

function DailyPage({ employees, selectedDate, setSelectedDate, getStatus, setStatus, notify }: any) {
  const worked = employees.filter((e: Employee)=>getStatus(e.id,selectedDate)==="worked").length;
  const absent = employees.filter((e: Employee)=>getStatus(e.id,selectedDate)==="absent").length;
  return <>
    <PageHeading eyebrow="CONTROLE DIÁRIO" title="Diárias e presença" description="Marque quem trabalhou, faltou ou teve folga. O valor da diária entra no fechamento da semana."/>
    <div className="toolbar-card"><div className="date-picker-wrap"><CalendarDays size={18}/><label>Data do registro<input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label></div><div className="toolbar-counts"><span className="count-green">{worked} trabalharam</span><span className="count-red">{absent} faltas</span><span>{employees.length-worked-absent} sem registro/folga</span></div></div>
    <div className="section-title-row"><div><h2>Equipe do dia</h2><p>Toque em uma opção para registrar a situação.</p></div><span className="muted-count">{employees.length} pessoas</span></div>
    <div className="attendance-list">{employees.map((e: Employee)=>{const status=getStatus(e.id,selectedDate);return <div className="attendance-card" key={e.id}><div className="person-info"><div className="person-avatar">{e.name.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{e.name}</b><small>{e.role} · {money(e.dailyRate)}/diária</small></div></div><div className="status-actions"><button aria-label="Trabalhou" title="Trabalhou" className={status==="worked"?"status-choice selected worked":"status-choice"} onClick={()=>{setStatus(e.id,selectedDate,"worked");notify("Diária registrada para "+e.name);}}><Check size={16}/><span>Fez</span></button><button aria-label="Falta" title="Falta" className={status==="absent"?"status-choice selected absent":"status-choice"} onClick={()=>{setStatus(e.id,selectedDate,"absent");notify("Falta registrada para "+e.name);}}><X size={16}/><span>Faltou</span></button><button aria-label="Folga" title="Folga" className={status==="off"?"status-choice selected off":"status-choice"} onClick={()=>{setStatus(e.id,selectedDate,"off");notify("Folga registrada para "+e.name);}}><span>—</span><span>Folga</span></button></div></div>})}</div>
    <div className="tip-box"><AlertCircle size={17}/><span>Os registros são salvos automaticamente neste navegador. Para fechar a semana, acesse <b>Fechamento</b>.</span></div>
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
  const filtered = employees.filter((e:Employee)=>e.name.toLowerCase().includes(query.toLowerCase())||e.role.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading eyebrow="CADASTRO" title="Equipe" description="Cadastre as pessoas e defina o valor da diária e da hora extra." action={<button className="btn-primary" onClick={onAdd}><Plus size={17}/> Novo funcionário</button>}/>
    <div className="toolbar-card search-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar funcionário..."/></div><span className="muted-count">{employees.filter((e:Employee)=>e.active).length} ativos</span></div>
    <div className="team-grid">{filtered.map((e:Employee)=><div className="team-card" key={e.id}><div className="team-card-top"><div className="person-info"><div className="person-avatar">{e.name.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{e.name}</b><small>{e.role}</small></div></div><button className="icon-button" onClick={()=>onEdit(e)} aria-label="Editar funcionário"><Settings2 size={18}/></button></div><div className="rate-row"><div><small>Valor da diária</small><b>{money(e.dailyRate)}</b></div><div><small>Hora extra</small><b>{money(e.hourlyRate)}/h</b></div></div><div className="team-card-bottom"><span className="status-pill success">Ativo</span><button className="text-link" onClick={()=>onToggle(e.id)}>Desativar</button></div></div>)}</div>
    {filtered.length===0&&<div className="empty-state"><b>Nenhum funcionário encontrado</b><p>Tente outro nome ou cadastre uma pessoa.</p></div>}
  </>;
}

function ClosingPage({ rows, weekStart, setWeekStart, weekEnd, total, paidTotal, pendingCount, onTogglePaid, onExport }: any) {
  return <>
    <PageHeading eyebrow="PAGAMENTO SEMANAL" title="Fechamento da semana" description="Confira as diárias e horas extras, depois marque quem já recebeu." action={<button className="btn-outline" onClick={onExport}><Download size={17}/> Exportar CSV</button>}/>
    <div className="week-selector"><button className="icon-button" onClick={()=>setWeekStart(shiftDate(weekStart,-7))}><ArrowLeft size={18}/></button><div><b>{fmtDate(weekStart)} – {fmtDate(weekEnd)}</b><small>Período de segunda a domingo</small></div><button className="icon-button" onClick={()=>setWeekStart(shiftDate(weekStart,7))}><ArrowRight size={18}/></button><button className="today-button" onClick={()=>setWeekStart(mondayOf(todayISO()))}>Semana atual</button></div>
    <div className="stats-grid closing-stats"><StatCard label="Total previsto" value={money(total)} detail="Diárias + horas extras" icon={CircleDollarSign} tone="green"/><StatCard label="Já marcado como pago" value={money(paidTotal)} detail="Pagamentos confirmados" icon={CheckCircle2} tone="blue"/><StatCard label="Pendentes" value={pendingCount} detail="Pessoas aguardando pagamento" icon={AlertCircle} tone="amber"/></div>
    <div className="section-title-row"><div><h2>Resumo por funcionário</h2><p>O total considera apenas os dias marcados como “Fez” e as horas extras lançadas.</p></div></div>
    <div className="closing-list">{rows.map((r:any)=><div className="closing-card" key={r.employee.id}><div className="closing-main"><div className="person-avatar">{r.employee.name.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}</div><div className="closing-name"><b>{r.employee.name}</b><small>{r.workedDays} diárias · {r.absences} faltas · {r.extraHours.toLocaleString("pt-BR")}h extras</small></div><div className="closing-total"><b>{money(r.total)}</b><small>{r.paid?"Pagamento realizado":"Aguardando pagamento"}</small></div></div><div className="closing-bottom"><span className={r.paid?"status-pill success":"status-pill warning"}>{r.paid?"Pago":"Pendente"}</span><button className={r.paid?"btn-paid":"btn-mark-paid"} disabled={r.total===0} onClick={()=>onTogglePaid(r.employee.id,!r.paid)}>{r.paid?<><CheckCircle2 size={15}/> Pago</>:<><Check size={15}/> Marcar como pago</>}</button></div></div>)}</div>
    <div className="closing-total-bar"><span>Total da semana</span><b>{money(total)}</b></div>
    <div className="tip-box"><AlertCircle size={17}/><span>Este fechamento é um controle interno. Marcar como pago não realiza transferência bancária; apenas registra a baixa no sistema.</span></div>
  </>;
}

function EmployeeModal({ employee, onClose, onSave }: any) {
  const [name,setName]=useState(employee?.name??""); const [role,setRole]=useState(employee?.role??""); const [daily,setDaily]=useState(String(employee?.dailyRate??"")); const [hourly,setHourly]=useState(String(employee?.hourlyRate??""));
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(!name.trim()||Number(daily)<0||Number(hourly)<0)return;onSave({name:name.trim(),role:role.trim()||"Funcionário",dailyRate:Number(daily),hourlyRate:Number(hourly)},employee?.id);};
  return <Modal title={employee?"Editar funcionário":"Novo funcionário"} onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: João da Silva"/></label><label>Função / cargo<input value={role} onChange={e=>setRole(e.target.value)} placeholder="Ex.: Auxiliar"/></label><div className="form-grid"><label>Valor da diária (R$)<input type="number" min="0" step="0.01" required value={daily} onChange={e=>setDaily(e.target.value)}/></label><label>Valor da hora extra (R$)<input type="number" min="0" step="0.01" required value={hourly} onChange={e=>setHourly(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button className="btn-primary" type="submit"><Check size={16}/> Salvar funcionário</button></div></form></Modal>;
}
function OvertimeModal({ employees, selectedDate, onClose, onSave }: any) {
  const [employeeId,setEmployeeId]=useState(employees[0]?.id??""); const [date,setDate]=useState(selectedDate); const [hours,setHours]=useState("1"); const [note,setNote]=useState("");
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(employeeId&&Number(hours)>0)onSave(employeeId,date,Number(hours),note.trim());};
  return <Modal title="Registrar hora extra" onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Funcionário<select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}>{employees.map((e:Employee)=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label><div className="form-grid"><label>Data<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Quantidade de horas<input type="number" min="0.25" step="0.25" required value={hours} onChange={e=>setHours(e.target.value)}/></label></div><label>Observação (opcional)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex.: ficou até mais tarde"/></label><div className="modal-actions"><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button className="btn-primary" type="submit"><Check size={16}/> Salvar lançamento</button></div></form></Modal>;
}
function Modal({ title, children, onClose }: any) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }

export default App;