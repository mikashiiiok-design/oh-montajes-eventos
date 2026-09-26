import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

const legalVariants = {
  terms: {
    slug: 'terminos-y-condiciones',
    title: 'Términos y condiciones',
    intro: 'Estas condiciones regulan el uso de la plataforma, el acceso a la cuenta y la forma en que OH Montajes y Eventos presta sus servicios.',
    sections: [
      {
        heading: '1. Aceptación',
        body: 'Al crear una cuenta y utilizar nuestra web, aceptas estas condiciones generales, así como la información que hayas facilitado durante el registro y cualquier servicio adicional que solicites.',
      },
      {
        heading: '2. Uso de la plataforma',
        body: 'El sitio se utiliza para consultar servicios, solicitar cotizaciones, coordinar eventos y gestionar la información relacionada con pedidos y atención de clientes. El usuario se compromete a usar la plataforma de forma responsable, veraz y legal.',
      },
      {
        heading: '3. Información personal',
        body: 'OH Montajes y Eventos protegerá la información suministrada con la finalidad de atender solicitudes, gestionar cuentas y comunicar asuntos relacionados con el servicio. La información se usará conforme a la política interna de protección de datos y la normativa aplicable.',
      },
      {
        heading: '4. Responsabilidad',
        body: 'La empresa no será responsable por daños derivados del uso indebido, fallos técnicos ajenos a su control, ni por información falsa proporcionada por terceros o clientes. El cliente es responsable de verificar la exactitud de los datos y requisitos de su proyecto.',
      },
      {
        heading: '5. Cambios',
        body: 'OH Montajes y Eventos puede actualizar estos términos para reflejar cambios en procesos, servicios o requisitos legales. Las modificaciones entrarán en vigor desde su publicación en esta página.',
      },
    ],
  },
  service: {
    slug: 'terminos-de-servicio',
    title: 'Términos de uso',
    intro: 'Estos términos describen la forma en que se presta el servicio en la web y cómo deben interactuar las personas con la plataforma.',
    sections: [
      {
        heading: '1. Alcance del servicio',
        body: 'OH Montajes y Eventos ofrece información, contacto, cotizaciones y gestión asociada a servicios de montajes, decoración, logística y producción para eventos. El alcance final del servicio puede variar según la solicitud, el presupuesto y la disponibilidad confirmada.',
      },
      {
        heading: '2. Solicitudes y cotizaciones',
        body: 'Las solicitudes, conversaciones y cotizaciones en la plataforma son herramientas de apoyo. Toda propuesta final se confirmará por parte del equipo comercial y puede ajustarse por disponibilidad, montaje, transporte, impuestos o cambios de alcance.',
      },
      {
        heading: '3. Disponibilidad y tiempos',
        body: 'El equipo buscará responder con prontitud, aunque la atención efectiva puede depender de la complejidad del proyecto, la etapa de coordinación y la disponibilidad del calendario del cliente.',
      },
      {
        heading: '4. Confidencialidad',
        body: 'La información entregada por los clientes será tratada con discreción y respeto, con el fin de coordinar eventos y proyectos de forma segura. No se compartirá con terceros salvo que exista una obligación legal o autorización clara del cliente.',
      },
      {
        heading: '5. Finalidad de la web',
        body: 'La plataforma tiene un propósito informativo y operativo, no reemplaza acuerdos contractuales formales ni reemplaza la atención humana directa para decisiones finales sobre contratación, cronogramas o alcance específico.',
      },
    ],
  },
}

function LegalPage({ variant = 'terms' }) {
  const content = legalVariants[variant] ?? legalVariants.terms

  useScrollReveal()

  useEffect(() => {
    document.title = `${content.title} | OH Montajes y Eventos`
    const robotsMeta = document.createElement('meta')
    robotsMeta.name = 'robots'
    robotsMeta.content = 'noindex, nofollow'
    document.head.append(robotsMeta)

    return () => {
      document.title = 'OH Montajes y Eventos — Producción con intención'
      robotsMeta.remove()
    }
  }, [content.title])

  return (
    <main className="legal-page">
      <header className="legal-header" data-reveal>
        <a className="legal-brand" href="/" aria-label="OH Montajes y Eventos, inicio">
          <img src={companyLogo} alt="OH Montajes y Eventos" />
        </a>
        <a className="legal-back" href="/"><ArrowLeft size={16} /> Volver al inicio</a>
      </header>

      <section className="legal-shell" aria-labelledby="legal-title" data-reveal>
        <p className="eyebrow legal-eyebrow"><span className="section-index">OH</span> Aviso legal</p>
        <h1 id="legal-title">{content.title}</h1>
        <p className="legal-intro">{content.intro}</p>

        <div className="legal-content" data-reveal-stagger>
          {content.sections.map((section, index) => (
            <article key={section.heading} className="legal-card" data-reveal data-reveal-delay={index * 90}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="legal-footer" data-reveal>
        <span>OH Montajes y Eventos</span>
        <span>{content.slug === 'terminos-y-condiciones' ? 'Términos y condiciones' : 'Términos de uso'}</span>
      </footer>
    </main>
  )
}

export default LegalPage
