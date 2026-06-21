export function ChannelSearch({ value = '', onChange = () => {} }) {
  return (
    <label className="field channel-search">
      <span>Buscar</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="nome do canal" />
    </label>
  );
}
