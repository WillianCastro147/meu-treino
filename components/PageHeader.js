// Cabeçalho das abas: título grande, subtítulo cinza e uma ação redonda à direita
export default function PageHeader({ title, sub, action }) {
  return (
    <div className="page-head big">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
