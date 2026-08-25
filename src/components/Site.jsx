import { useState, useEffect, useRef } from 'react';
import '../index.css';
import api from "../services/api";

const FadeIn = ({ children, style, delay = '0s' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={domRef} style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(50px)', transition: `opacity 0.8s ease-out ${delay}, transform 0.8s ease-out ${delay}`, ...style }}>
      {children}
    </div>
  );
};

export default function Site({ setView, horariosOcupados, handleAgendar }) {
  const [activePage, setActivePage] = useState('inicio');

  const [formulario, setFormulario] = useState({
    nome: '', telefone: '', cortes: [], data: '', hora: '', barbeiro: ''
  });


  // ============================================================
  // CONEXÃO COM O BACKEND JAVA
  // ============================================================

  // Guarda os barbeiros que vierem do Backend
  const [barbeirosBackend, setBarbeirosBackend] = useState([]);
  const [servicosBackend, setServicosBackend] = useState([]);

  // Executa quando a página é aberta
  useEffect(() => {

    // Faz GET para o Backend Java
    // http://localhost:8080/barbeiro
    api.get("/barbeiro")

      // Se der certo
      .then(response => {

        // Mostra no console o que veio do Backend
        console.log(
          "Barbeiros recebidos do Backend:",
          response.data
        );

        // Guarda os dados recebidos
        setBarbeirosBackend(response.data);
      })

      // Se der erro
      .catch(error => {

        console.error(
          "Erro ao conectar com o Backend:",
          error
        );

      });

    // Busca os serviços no Backend
    api.get("/servico")
      .then(response => {
        console.log("Serviços recebidos do Backend:", response.data);

        if (Array.isArray(response.data)) {
          setServicosBackend(response.data);
        } else {
          console.error("O Backend não retornou uma lista de serviços:", response.data);
          setServicosBackend([]);
        }
      })
      .catch(error => {
        console.error("Erro ao buscar serviços:", error);
        setServicosBackend([]);
      });

  }, []);




  const profissionais = barbeirosBackend;

  // Serviços vindos do Backend
  const cortesDisponiveis = servicosBackend.map(servico => {
    const valor = Number(servico.valor);

    return {
      id: servico.id,
      nome: servico.nome,
      preco: `R$ ${valor.toFixed(2).replace('.', ',')}`,
      valorReal: valor,
      desc: `Duração: ${servico.duracao} minutos`
    };
  });

  const hoje = new Date().toLocaleDateString('en-CA');
  const ehDataPassada = formulario.data && formulario.data < hoje;

  let diaDaSemana = -1;
  if (formulario.data) {
    const [ano, mes, dia] = formulario.data.split('-');
    const dataSelecionada = new Date(ano, mes - 1, dia);
    diaDaSemana = dataSelecionada.getDay();
  }

  let horariosBase = [];
  if (diaDaSemana >= 1 && diaDaSemana <= 5) {
    horariosBase = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];
  } else if (diaDaSemana === 6) {
    horariosBase = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
  }

  const chaveAgenda = `${formulario.data}_${formulario.barbeiro}`;
  const horariosDisponiveis = (formulario.data && formulario.barbeiro && !ehDataPassada && horariosBase.length > 0)
    ? horariosBase.filter(hora => !(horariosOcupados[chaveAgenda] || []).includes(hora))
    : [];

  const handleChange = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value });

  const toggleCorte = (idCorte) => {
    setFormulario(prev => {
      const jaSelecionado = prev.cortes.includes(idCorte);
      const novosCortes = jaSelecionado
        ? prev.cortes.filter(c => c !== idCorte)
        : [...prev.cortes, idCorte];
      return { ...prev, cortes: novosCortes };
    });
  };

  const cortesEscolhidos = cortesDisponiveis.filter(c => formulario.cortes.includes(c.id));
  const precoTotal = cortesEscolhidos.reduce((acc, c) => acc + c.valorReal, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formulario.cortes.length === 0)
      return alert("Escolha pelo menos um serviço.");

    if (!formulario.barbeiro)
      return alert("Escolha um profissional.");

    if (!formulario.data)
      return alert("Escolha uma data.");

    if (!formulario.hora)
      return alert("Escolha um horário.");

    if (ehDataPassada)
      return alert("Não é possível agendar em uma data que já passou!");

    if (horariosBase.length === 0)
      return alert("Estamos fechados neste dia! Escolha outra data.");

    // Pega o primeiro serviço selecionado
    const servicoSelecionado = formulario.cortes[0];

    try {

      // ============================================================
      // ENVIA O AGENDAMENTO PARA O BACKEND JAVA
      // ============================================================

      const response = await api.post("/agendamento/create", {

        // ID será gerado pelo Backend
        id: null,

        // Data escolhida pelo cliente
        data: formulario.data,

        // Horário escolhido pelo cliente
        hora: formulario.hora,

        // Status inicial
        status: "pendente",

        // Usuário
        // Atualmente estamos usando o usuário 1
        usuarioId: 1,

        // ID do barbeiro escolhido
        barbeiroId: formulario.barbeiro,

        // ID do serviço escolhido
        servicoId: servicoSelecionado

      });

      console.log(
        "Agendamento criado no Backend:",
        response.data
      );

      // ============================================================
      // WHATSAPP
      // ============================================================

      const barbeiroSelecionado =
        profissionais.find(
          prof => prof.id === formulario.barbeiro
        );

      const servicoSelecionadoObj =
        cortesDisponiveis.find(
          servico => servico.id === servicoSelecionado
        );

      const dataFormatada =
        formulario.data
          .split('-')
          .reverse()
          .join('/');

      const telefoneBarbearia = "553291440052";

      const mensagem =
        `Confirmo o agendamento com o Barber shop Batatabowl ` +
        `dia ${dataFormatada} às ${formulario.hora}. ` +
        `Barbeiro: ${barbeiroSelecionado?.nome}. ` +
        `Serviço: ${servicoSelecionadoObj?.nome}.`;

      window.open(
        `https://wa.me/${telefoneBarbearia}?text=${encodeURIComponent(mensagem)}`,
        '_blank'
      );

      // Limpa o formulário depois de salvar
      setFormulario({
        nome: '',
        telefone: '',
        cortes: [],
        data: '',
        hora: '',
        barbeiro: ''
      });

    } catch (error) {

      console.error(
        "Erro ao criar agendamento:",
        error
      );

      alert(
        "Não foi possível realizar o agendamento. Verifique se o Backend está funcionando."
      );
    }
  };

  const scrollToSection = (id) => {
    setActivePage(id);
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const inputStyle = { width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1A1A1A', color: 'var(--text-light)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' };

  let textoSelectHora = "Escolha o profissional e a data";
  if (formulario.barbeiro && formulario.data) {
    if (ehDataPassada) textoSelectHora = "❌ Data Indisponível";
    else if (horariosBase.length === 0) textoSelectHora = "❌ Fechado aos Domingos";
    else textoSelectHora = "Escolha o Horário";
  }

  const cardQualidadeStyle = { backgroundColor: '#1A1A1A', padding: '20px', borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      <header style={{
        backgroundImage: `url('/Cabecalho.png')`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0A0A0A',
        padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px',
        position: 'sticky', top: 0, zIndex: 1000
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <button onClick={() => setView('login')} style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid #444', color: '#ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>⚙️ Área Restrita</button>
        </div>

        <nav style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
          <button onClick={() => scrollToSection('inicio')} style={{ background: 'transparent', border: 'none', color: activePage === 'inicio' ? 'var(--gold)' : '#fff', borderBottom: activePage === 'inicio' ? '3px solid var(--gold)' : '3px solid transparent', padding: '8px 12px', fontSize: 'clamp(1rem, 2vw, 1.2rem)', cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Início</button>
          <button onClick={() => scrollToSection('profissionais')} style={{ background: 'transparent', border: 'none', color: activePage === 'profissionais' ? 'var(--gold)' : '#fff', borderBottom: activePage === 'profissionais' ? '3px solid var(--gold)' : '3px solid transparent', padding: '8px 12px', fontSize: 'clamp(1rem, 2vw, 1.2rem)', cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Barbeiros</button>
          <button onClick={() => scrollToSection('agendamento')} style={{ background: 'transparent', border: 'none', color: activePage === 'agendamento' ? 'var(--gold)' : '#fff', borderBottom: activePage === 'agendamento' ? '3px solid var(--gold)' : '3px solid transparent', padding: '8px 12px', fontSize: 'clamp(1rem, 2vw, 1.2rem)', cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Agendar Horário</button>
          <button onClick={() => scrollToSection('sobre-localizacao')} style={{ background: 'transparent', border: 'none', color: activePage === 'sobre-localizacao' ? 'var(--gold)' : '#fff', borderBottom: activePage === 'sobre-localizacao' ? '3px solid var(--gold)' : '3px solid transparent', padding: '8px 12px', fontSize: 'clamp(1rem, 2vw, 1.2rem)', cursor: 'pointer', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Sobre & Localização</button>
        </nav>
      </header>

      <section id="inicio" style={{ backgroundImage: `linear-gradient(to bottom, transparent 0%, transparent 70%, #121212 100%), url('/Banner.jpeg')`, backgroundColor: '#000', backgroundSize: 'cover', backgroundPosition: '30% center', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', paddingBottom: '15vh' }}>
        <FadeIn style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', color: '#fff', marginBottom: '20px', textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>Onde a tradição encontra o <br /><strong style={{ color: 'var(--gold)' }}>seu melhor estilo.</strong></h2>
          <button onClick={() => scrollToSection('agendamento')} style={{ padding: '15px 30px', backgroundColor: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 15px rgba(218, 165, 32, 0.3)' }}>Agendar Meu Horário</button>
        </FadeIn>
      </section>

      <main style={{ padding: '0 5%', maxWidth: '1600px', margin: '0 auto', width: '100%', flexGrow: 1 }}>

        <section id="profissionais" style={{ width: '100%', marginTop: '40px', paddingTop: '60px', paddingBottom: '60px', scrollMarginTop: '100px' }}>
          <FadeIn><h2 style={{ color: 'var(--gold)', fontSize: 'clamp(2rem, 5vw, 2.5rem)', borderBottom: '2px solid #333', paddingBottom: '15px', marginBottom: '40px' }}>Nossos Profissionais</h2></FadeIn>

          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>

            {/* CARD KAUAN */}
            <FadeIn style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }} delay="0s">
              {/* O VAR ATUOU AQUI: backgroundPosition ajustado para 'center 30%' */}
              <div style={{ width: '100%', height: '350px', backgroundImage: `url('/Foto Kauan.jpeg')`, backgroundSize: 'cover', backgroundPosition: 'center 30%', borderRadius: '16px', marginBottom: '20px', border: '1px solid #333' }}></div>
              <p style={{ color: 'var(--gold)', fontWeight: 'bold', letterSpacing: '2px', fontSize: '0.9rem', margin: '0 0 10px 0' }}>SOBRE MIM</p>
              <h3 style={{ color: '#fff', fontSize: '2.2rem', margin: '0 0 15px 0' }}>Conheça o <span style={{ color: 'var(--gold)' }}>Kauan</span></h3>
              <p style={{ color: '#ccc', lineHeight: '1.6', fontSize: '1.1rem', marginBottom: '30px' }}>Kauan é um barbeiro em crescimento, com grande dedicação e talento. Mesmo jovem, já demonstra alto nível técnico, oferecendo cortes modernos, acabamento preciso e um atendimento totalmente diferenciado.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>✂️</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Corte Moderno</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Sempre atualizado nas tendências</p>
                </div>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>⏱️</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Pontualidade</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Sempre no horário marcado</p>
                </div>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>🏅</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Qualidade Profissional</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Alto nível técnico garantido</p>
                </div>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>👁️</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Atenção aos Detalhes</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Acabamento impecável</p>
                </div>
              </div>
            </FadeIn>

            {/* CARD MATHEUS */}
            <FadeIn style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }} delay="0.2s">
              {/* O VAR ATUOU AQUI: backgroundPosition ajustado para 'center 30%' */}
              <div style={{ width: '100%', height: '350px', backgroundImage: `url('/Foto Matheus.jpeg')`, backgroundSize: 'cover', backgroundPosition: 'center 30%', borderRadius: '16px', marginBottom: '20px', border: '1px solid #333' }}></div>
              <p style={{ color: 'var(--gold)', fontWeight: 'bold', letterSpacing: '2px', fontSize: '0.9rem', margin: '0 0 10px 0' }}>SOBRE MIM</p>
              <h3 style={{ color: '#fff', fontSize: '2.2rem', margin: '0 0 15px 0' }}>Conheça o <span style={{ color: 'var(--gold)' }}>Matheus</span></h3>
              <p style={{ color: '#ccc', lineHeight: '1.6', fontSize: '1.1rem', marginBottom: '30px' }}>Especialista em visagismo e cortes alinhados, Matheus une tradição e modernidade. Com foco total na experiência do cliente, garante um visual autêntico e perfeitamente ajustado ao seu formato de rosto.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>💈</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Barba Terapia</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Relaxamento e cuidado total</p>
                </div>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>🤝</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Atendimento Premium</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Foco máximo na sua experiência</p>
                </div>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>📐</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Visagismo</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>O corte ideal para o seu rosto</p>
                </div>
                <div style={cardQualidadeStyle}>
                  <div style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>🎩</div>
                  <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Estilo Clássico</h4>
                  <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Elegância que nunca sai de moda</p>
                </div>
              </div>
            </FadeIn>

          </div>
        </section>

        <section id="agendamento" style={{ width: '100%', marginTop: '40px', paddingTop: '60px', paddingBottom: '60px', borderTop: '1px solid #222', position: 'relative', zIndex: 10, scrollMarginTop: '100px' }}>
          <FadeIn><h2 style={{ color: 'var(--gold)', fontSize: 'clamp(2rem, 5vw, 2.5rem)', borderBottom: '2px solid #333', paddingBottom: '15px', marginBottom: '40px' }}>Agende seu Horário</h2></FadeIn>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'space-between' }}>

            <FadeIn style={{ flex: '1 1 300px' }} delay="0s">
              <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.3rem' }}>Seus Dados</h3>
              <input type="text" name="nome" value={formulario.nome} onChange={handleChange} required style={inputStyle} placeholder="Nome Completo" />
              <input type="tel" name="telefone" value={formulario.telefone} onChange={handleChange} required style={inputStyle} placeholder="WhatsApp" />

              <h3 style={{ color: '#fff', margin: '20px 0 15px 0', fontSize: '1.3rem' }}>Profissional</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {profissionais.map(prof => (
                  <button
                    type="button"
                    key={prof.id}

                    // Guarda o ID do barbeiro selecionado
                    onClick={() => setFormulario({
                      ...formulario,
                      barbeiro: prof.id,
                      hora: ''
                    })}

                    style={{
                      flex: 1,
                      padding: '15px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      transition: 'all 0.2s',

                      border: formulario.barbeiro === prof.id
                        ? '2px solid var(--gold)'
                        : '1px solid #444',

                      backgroundColor: formulario.barbeiro === prof.id
                        ? 'var(--gold)'
                        : '#1A1A1A',

                      color: formulario.barbeiro === prof.id
                        ? '#000'
                        : '#fff'
                    }}
                  >
                    {/* Mostra o nome que veio do Backend */}
                    {prof.nome}
                  </button>
                ))}
              </div>

              <h3 style={{ color: '#fff', margin: '20px 0 15px 0', fontSize: '1.3rem' }}>Data e Hora</h3>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <input type="date" name="data" value={formulario.data} min={hoje} onChange={handleChange} required disabled={!formulario.barbeiro} style={{ ...inputStyle, flex: '1 1 140px', marginBottom: 0 }} />

                <select name="hora" value={formulario.hora} onChange={handleChange} required style={{ ...inputStyle, flex: '1 1 140px', marginBottom: 0 }} disabled={!formulario.data || !formulario.barbeiro || ehDataPassada || horariosBase.length === 0}>
                  <option value="" disabled>{textoSelectHora}</option>
                  {horariosDisponiveis.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </FadeIn>

            <FadeIn style={{ flex: '1 1 300px' }} delay="0.2s">
              <h3 style={{ color: '#fff', marginBottom: '20px', fontSize: '1.3rem' }}>Serviços (Pode escolher mais de um)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cortesDisponiveis.length > 0 ? (
                  cortesDisponiveis.map((c) => {
                    const isSelected = formulario.cortes.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCorte(c.id)}
                        style={{
                          padding: '20px 15px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'rgba(218, 165, 32, 0.15)'
                            : '#1A1A1A',
                          border: isSelected
                            ? '2px solid var(--gold)'
                            : '2px solid #444',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '15px'
                        }}>

                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: '2px solid var(--gold)',
                            backgroundColor: isSelected
                              ? 'var(--gold)'
                              : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && (
                              <span style={{
                                color: '#000',
                                fontWeight: 'bold',
                                fontSize: '14px'
                              }}>
                                ✓
                              </span>
                            )}
                          </div>

                          <div>
                            <h4 style={{
                              margin: '0 0 5px 0',
                              color: isSelected ? 'var(--gold)' : '#fff',
                              fontSize: '1.1rem'
                            }}>
                              {c.nome}
                            </h4>

                            <p style={{
                              margin: 0,
                              color: '#aaa',
                              fontSize: '0.85rem'
                            }}>
                              {c.desc}
                            </p>
                          </div>
                        </div>

                        <span style={{
                          color: 'var(--gold)',
                          fontWeight: 'bold',
                          fontSize: '1.2rem'
                        }}>
                          {c.preco}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p style={{
                    color: '#aaa',
                    textAlign: 'center',
                    padding: '20px'
                  }}>
                    Nenhum serviço disponível no momento.
                  </p>
                )}
              </div>

              <button type="submit" style={{ width: '100%', padding: '20px', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px' }}>
                Confirmar no WhatsApp {precoTotal > 0 ? `(Total: R$ ${precoTotal.toFixed(2).replace('.', ',')})` : ''}
              </button>
            </FadeIn>
          </form>
        </section>

        <div id="sobre-localizacao" style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', marginTop: '40px', paddingTop: '60px', paddingBottom: '100px', alignItems: 'stretch', borderTop: '1px solid #222', scrollMarginTop: '100px' }}>
          <FadeIn style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }} delay="0s">
            <h2 style={{ color: 'var(--gold)', borderBottom: '2px solid #333', paddingBottom: '15px', fontSize: 'clamp(2rem, 5vw, 2.5rem)', marginBottom: '20px' }}>Sobre a Batatabowl</h2>
            <div style={{ backgroundColor: '#1A1A1A', padding: '30px', borderRadius: '16px', flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <p style={{ lineHeight: '1.6', fontSize: '1.1rem', color: '#ccc', margin: 0 }}>Tradição, estilo e um ambiente exclusivo. Nossa barbearia foi pensada para entregar o melhor corte e a melhor experiência para você.</p>
            </div>
          </FadeIn>
          <FadeIn style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }} delay="0.2s">
            <h2 style={{ color: 'var(--gold)', borderBottom: '2px solid #333', paddingBottom: '15px', fontSize: 'clamp(2rem, 5vw, 2.5rem)', marginBottom: '20px' }}>Onde Estamos</h2>
            <p style={{ fontSize: '1.1rem', color: '#ccc', marginBottom: '15px' }}>R. Sargento Cunha, 15 - Bandeirantes, Juiz de Fora - MG</p>
            <div style={{ flexGrow: 1, minHeight: '300px', borderRadius: '12px', overflow: 'hidden' }}>
              <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3705.513476405781!2d-43.34112108443834!3d-21.7603387856066!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x989b604e4e976b%3A0xc3b83842183e8fa2!2sR.%20Sargento%20Cunha%2C%2015%20-%20Bandeirantes%2C%20Juiz%20de%20Fora%20-%20MG%2C%2036047-010!5e0!3m2!1spt-BR!2sbr!4v1680000000000!5m2!1spt-BR!2sbr" width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
            </div>
          </FadeIn>
        </div>
      </main>
    </div>
  );
}