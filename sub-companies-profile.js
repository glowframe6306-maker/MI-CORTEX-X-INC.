document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('body > main');
  const listingHero = main?.querySelector(':scope > .page-hero');
  const listingSection = main?.querySelector(':scope > [data-sub-company-listing]');
  const profileView = main?.querySelector(':scope > [data-sub-company-profile]');
  const profileContent = profileView?.querySelector('.sub-company-profile__content');
  if (!main || !listingHero || !listingSection || !profileView || !profileContent) return;

  const plannedTool = (name, category, icon, description) => ({
    name,
    category,
    icon,
    description,
    status: 'PLANNED'
  });

  const profiles = [
    {
      id: 'hardtech',
      name: 'MI CORTEX HARDTECH',
      identity: 'Hardware & systems engineering',
      summary: 'A proposed hardware and computer-systems brand exploring practical devices, components and integrated technology.',
      industry: 'Computer hardware, electronics and connected systems',
      purpose: 'To research and shape dependable physical technology concepts that could complement MI CORTEX X INC. software and digital platforms.',
      vision: 'Make useful, repairable and thoughtfully integrated technology more accessible to people and organizations.',
      mission: 'Explore hardware products and engineering services through responsible research, prototyping and clear technical documentation.',
      objectives: ['Identify practical needs for computing and connected devices.', 'Develop concepts that consider reliability, maintainability and user safety.', 'Connect physical products with appropriate software and digital services.'],
      products: [
        { name: 'Cortex Modular Workstation', category: 'Computing systems', description: 'A proposed configurable computer platform for study, creative work and small-team productivity.', features: ['Conceptual component configurations for different workloads.', 'A serviceable layout designed to simplify future upgrades.', 'Optional integration planning for approved MI CORTEX software.'], users: 'Students, creators, technical teams and small organizations.' },
        { name: 'Cortex Edge Device Kit', category: 'Embedded and connected devices', description: 'A proposed development kit concept for evaluating sensors, small controllers and local data processing.', features: ['Interchangeable sensor and controller concepts.', 'Local-first data collection and device-status monitoring.', 'Documented interfaces for prototyping and experimentation.'], users: 'Educators, makers, researchers and product-development teams.' }
      ],
      services: [
        { name: 'Hardware needs assessment', description: 'Review a proposed use case and outline suitable computing, component and connectivity requirements.', deliverable: 'A documented requirements outline and high-level hardware options; no supply or installation is currently offered.', customers: 'Organizations planning a new digital workspace or device concept.' },
        { name: 'Prototype design exploration', description: 'Explore enclosure, component layout, interface and integration ideas for an early hardware concept.', deliverable: 'Concept sketches, component considerations and a prototype plan.', customers: 'Startups, educators and internal product teams.' },
        { name: 'Systems integration planning', description: 'Map how proposed devices could communicate with software, networks and supporting services.', deliverable: 'A draft architecture and integration checklist.', customers: 'Teams connecting equipment to a future digital platform.' }
      ],
      operations: 'Planned activities include requirements research, component evaluation, system architecture, prototype planning and technical documentation. Any future hardware work would be subject to feasibility, safety and resource review.',
      expertise: ['Computer architecture and component selection', 'Embedded systems and device connectivity', 'Thermal, power and serviceability considerations', 'Hardware-to-software integration planning'],
      tools: [
        plannedTool('Hardware Diagnostic Tools', 'Diagnostics', '⌕', 'A proposed workflow for recording component checks, error indicators and guided troubleshooting steps.'),
        plannedTool('System Monitoring Tools', 'Monitoring', '◉', 'A planned dashboard concept for viewing processor, memory, storage, temperature and power-health signals.'),
        plannedTool('Hardware Compatibility Checker', 'Compatibility', '⇄', 'A proposed checker for comparing component specifications against documented system requirements.'),
        plannedTool('Component Information Tools', 'Reference', '▤', 'A planned reference workspace for organizing component specifications, interfaces and maintenance notes.'),
        plannedTool('Device Management Tools', 'Device management', '⌘', 'A concept for maintaining inventories, device profiles and lifecycle records for authorized equipment.'),
        plannedTool('Hardware Configuration Tools', 'Configuration', '⚙', 'A proposed interface for documenting safe system configurations and approved component changes.')
      ],
      research: ['Modular and repair-aware computing concepts', 'Low-power edge computing and sensor systems', 'Accessible device design and responsible material choices'],
      contribution: 'Could provide a physical-product and systems-engineering perspective to parent-company product concepts. No products or services are currently represented as available.',
      future: ['Evaluate small-batch, serviceable computer concepts.', 'Explore sensor and edge-computing kits for learning and prototyping.', 'Investigate carefully scoped device integration with other proposed digital products.'],
      accent: 'blue',
      logo: 'assets/HARDTECH.png'
    },
    {
      id: 'codex',
      name: 'MI CORTEX CODEX',
      identity: 'Software engineering & platforms',
      summary: 'A proposed software-engineering brand for applications, reliable digital platforms and maintainable code.',
      industry: 'Software development, application engineering and digital platforms',
      purpose: 'To shape software concepts and engineering practices that could support the parent company’s future digital products.',
      vision: 'Create dependable, understandable software that solves real problems and can evolve responsibly.',
      mission: 'Plan and develop application concepts using disciplined design, testing, accessibility and lifecycle thinking.',
      objectives: ['Translate user needs into clear software requirements.', 'Favor secure, testable and maintainable architectures.', 'Connect applications through documented and reliable interfaces.'],
      products: [
        { name: 'Cortex Workspace', category: 'Productivity platform', description: 'A proposed cross-device workspace concept for organizing projects, notes and team tasks.', features: ['Project and task organization with configurable views.', 'Searchable notes and reference material.', 'Role-aware collaboration concepts and exportable records.'], users: 'Individuals, student groups and small teams seeking a unified work hub.' },
        { name: 'Cortex Connect API', category: 'Developer platform', description: 'A proposed integration layer concept for connecting approved MI CORTEX applications and external tools.', features: ['Versioned API design and consistent authentication patterns.', 'Webhooks and integration status concepts.', 'Developer documentation and test-environment planning.'], users: 'Software teams and organizations planning interoperable systems.' }
      ],
      services: [
        { name: 'Application planning and prototyping', description: 'Turn an early product idea into a scoped user flow, architecture outline and prototype plan.', deliverable: 'Requirements, interface flows and a staged technical roadmap.', customers: 'Founders, small organizations and internal product teams.' },
        { name: 'Web and mobile engineering', description: 'Plan and, if formally offered in future, build responsive applications around agreed requirements.', deliverable: 'A proposed implementation plan covering interfaces, data, testing and release readiness.', customers: 'Organizations exploring a new web or mobile application.' },
        { name: 'Software quality and maintenance planning', description: 'Identify testing, observability, accessibility and lifecycle needs for an existing software concept.', deliverable: 'A prioritized quality and maintenance checklist.', customers: 'Teams preparing to improve or extend a digital product.' }
      ],
      operations: 'Planned work spans discovery, software architecture, interface engineering, API design, automated testing and technical documentation. Potential delivery models and technologies would be selected per project, not promised in advance.',
      expertise: ['Web and mobile application architecture', 'API design and service integration', 'Quality engineering and automated testing', 'Accessible interfaces and maintainable code'],
      tools: [
        plannedTool('Code Editor', 'Code authoring', '</>', 'A proposed development editor concept with project navigation, syntax-aware editing and configurable workspaces.'),
        plannedTool('Code Formatter', 'Code quality', '≡', 'A planned utility for applying consistent formatting rules to supported source files.'),
        plannedTool('Debugging Tools', 'Testing and debugging', '⌕', 'A concept for inspecting application state, tracing errors and organizing reproducible debugging notes.'),
        plannedTool('API Testing Tools', 'API development', '↔', 'A proposed workspace for composing requests and reviewing responses against documented API expectations.'),
        plannedTool('Version Control Tools', 'Source management', '⎇', 'A planned interface for reviewing changes, branches and commit history for authorized repositories.'),
        plannedTool('Database Management Tools', 'Data development', '▦', 'A concept for documenting database connections, schemas and query workflows with access controls.'),
        plannedTool('Development Workspace', 'Developer productivity', '▣', 'A proposed project hub bringing code, tasks, documentation and test status into one workspace.'),
        plannedTool('Code Documentation Tools', 'Documentation', '¶', 'A planned assistant for organizing API references, code explanations and project documentation.')
      ],
      research: ['Small, modular service architectures', 'Privacy-aware application patterns', 'Developer tooling and repeatable testing workflows'],
      contribution: 'Could provide software-engineering methods and shared platform components for parent-company initiatives. No software is being offered through this proposed profile.',
      future: ['Explore reusable identity, notification and integration components.', 'Research cross-platform application approaches.', 'Develop practical engineering guidelines for future product teams.'],
      accent: 'gold',
      logo: 'assets/CODEX.png'
    },
    {
      id: 'robotech',
      name: 'MI CORTEX ROBOTECH',
      identity: 'Robotics & intelligent automation',
      summary: 'A proposed robotics and automation brand focused on useful machines, control systems and human-centered workflows.',
      industry: 'Robotics engineering, automation and intelligent machines',
      purpose: 'To explore how robotics and automation concepts could help people perform repetitive, hazardous or precision-intensive tasks.',
      vision: 'Develop responsible machines that work predictably alongside people and improve practical workflows.',
      mission: 'Research robotic systems from sensing and control through safety, testing and operator experience.',
      objectives: ['Select use cases with clear human benefit and realistic constraints.', 'Prioritize safe operating boundaries and understandable controls.', 'Connect automation concepts with maintainable software and hardware.'],
      products: [
        { name: 'Cortex Rover Platform', category: 'Mobile robotics', description: 'A proposed educational mobile-robot concept for exploring navigation, sensing and control.', features: ['Modular sensor and compute layout.', 'Configurable route and obstacle-response experiments.', 'Operator-focused status and emergency-stop concepts.'], users: 'Schools, research groups and robotics learners.' },
        { name: 'Cortex Assist Cell', category: 'Collaborative automation', description: 'A proposed small-workcell concept for studying repetitive pick, sort or inspection workflows.', features: ['Task-specific tooling and sensor planning.', 'Human-supervised operation and safety-zone concepts.', 'Workflow simulation before physical deployment.'], users: 'Small manufacturers, labs and process-improvement teams.' }
      ],
      services: [
        { name: 'Automation opportunity study', description: 'Assess whether a defined repetitive workflow may be suitable for automation and identify constraints.', deliverable: 'A workflow map, feasibility questions and an initial risk register.', customers: 'Manufacturing, laboratory and logistics teams.' },
        { name: 'Robotics concept and simulation', description: 'Explore robot form, sensors, movement and task sequences in a concept or simulation plan.', deliverable: 'A system concept with proposed components and test scenarios.', customers: 'Educators, product teams and operations planners.' },
        { name: 'Control and integration planning', description: 'Outline how a proposed robot could interact with operators, equipment and supervisory software.', deliverable: 'A draft control, interface and integration architecture.', customers: 'Organizations evaluating a robotic pilot.' }
      ],
      operations: 'Planned activities include task analysis, mechanism and sensor research, control-system design, simulation, safety review and prototype evaluation. Physical deployments would require qualified engineering and site-specific validation.',
      expertise: ['Robot motion and control concepts', 'Sensors, perception and embedded computing', 'Workflow automation and simulation', 'Human-machine interaction and safety planning'],
      tools: [
        plannedTool('Robotics Simulation Tools', 'Simulation', '▧', 'A proposed environment for exploring robot models and task behavior before any physical testing.'),
        plannedTool('Robot Control Systems', 'Control systems', '⌘', 'A planned control workspace concept for configuring supervised robot behaviors and operating states.'),
        plannedTool('Automation Tools', 'Automation', '⚙', 'A concept for modeling repeatable automation sequences with clear review and safety checkpoints.'),
        plannedTool('Motion Planning Tools', 'Motion planning', '↗', 'A proposed planner for visualizing candidate paths and constraints in simulated environments.'),
        plannedTool('Sensor Monitoring Tools', 'Sensing', '◉', 'A planned interface for inspecting simulated or authorized sensor readings and health indicators.'),
        plannedTool('Robotics Programming Workspace', 'Development', '</>', 'A concept workspace for organizing robot programs, configuration and test scenarios.'),
        plannedTool('Robotics Testing Tools', 'Testing and safety', '✓', 'A proposed checklist and test-record system for controlled, staged robotics evaluation.')
      ],
      research: ['Low-cost mobile robotics', 'Collaborative automation boundaries', 'Reliable sensing in variable environments'],
      contribution: 'Could explore intelligent-machine concepts that complement the parent company’s software and hardware work. No deployed robots or operating facilities are claimed.',
      future: ['Develop educational robotics concepts and learning materials.', 'Study supervised automation for narrowly defined workflows.', 'Explore simulation-led design to reduce prototype risk.'],
      accent: 'blue',
      logo: 'assets/ROBOTECH.png'
    },
    {
      id: 'aitech',
      name: 'MI CORTEX AITECH',
      identity: 'Artificial intelligence & machine learning',
      summary: 'A proposed AI brand exploring useful, transparent and human-supervised intelligent software.',
      industry: 'Artificial intelligence, machine learning and AI-powered solutions',
      purpose: 'To investigate where AI can responsibly improve digital products while keeping people informed and in control.',
      vision: 'Make intelligent technology useful, understandable and accountable to the people it affects.',
      mission: 'Research AI product concepts with attention to data quality, privacy, evaluation and human oversight.',
      objectives: ['Choose well-defined problems for which AI adds measurable value.', 'Communicate model limits and uncertainty clearly.', 'Protect sensitive data and retain meaningful human review.'],
      products: [
        { name: 'Cortex Insight', category: 'Decision-support concept', description: 'A proposed analysis workspace that could summarize approved organizational information for human review.', features: ['Search and summarization grounded in selected source material.', 'Citations or source references for review.', 'Permission-aware workflows and human approval steps.'], users: 'Analysts and teams working with sizable document collections.' },
        { name: 'Cortex Flow AI', category: 'Automation assistant concept', description: 'A proposed assistant for classifying routine requests and preparing suggested next steps without silently taking consequential actions.', features: ['Configurable task classification and draft responses.', 'Human confirmation for external or high-impact actions.', 'Evaluation dashboards for quality and error review.'], users: 'Support, operations and administrative teams.' }
      ],
      services: [
        { name: 'AI use-case discovery', description: 'Assess a proposed workflow for suitability, risk, data needs and non-AI alternatives.', deliverable: 'A use-case assessment with feasibility and responsible-use considerations.', customers: 'Organizations exploring AI adoption.' },
        { name: 'Machine-learning prototype planning', description: 'Define a limited experiment with measurable success criteria and an evaluation dataset plan.', deliverable: 'A prototype brief, data checklist and evaluation approach.', customers: 'Product teams and researchers testing a specific hypothesis.' },
        { name: 'AI integration and governance planning', description: 'Map model use into an existing product with oversight, privacy and fallback considerations.', deliverable: 'A draft integration architecture and governance checklist.', customers: 'Teams integrating AI into customer or employee workflows.' }
      ],
      operations: 'Planned work covers problem framing, data readiness, model and tool evaluation, prototype design, testing and ongoing monitoring concepts. Any future system would need review for privacy, bias, security and suitability.',
      expertise: ['Machine-learning product design', 'Natural-language and document workflows', 'Model evaluation and monitoring concepts', 'Human oversight and privacy-aware integration'],
      tools: [
        plannedTool('AI Assistant Tools', 'AI assistance', '✦', 'A proposed assistant interface for drafting, summarizing and answering questions with clear limitations and review.'),
        plannedTool('Machine Learning Workspace', 'Machine learning', '▤', 'A planned workspace concept for organizing datasets, experiments and model-development records.'),
        plannedTool('AI Model Development Tools', 'Model development', '◇', 'A concept for tracking model configurations, evaluation runs and documented development decisions.'),
        plannedTool('Data Analysis Tools', 'Data analysis', '◫', 'A proposed environment for exploring datasets, visualizing patterns and recording analysis assumptions.'),
        plannedTool('Natural Language Processing Tools', 'Language technology', 'Aa', 'A planned set of text-processing capabilities for classification, extraction and language analysis experiments.'),
        plannedTool('AI Image and Content Tools', 'Generative media', '▧', 'A concept for responsible image and content workflows with clear human review and provenance considerations.'),
        plannedTool('AI Automation Tools', 'Automation', '⚙', 'A proposed workflow builder for supervised AI-assisted tasks, with approval steps before consequential actions.'),
        plannedTool('Model Evaluation Tools', 'Evaluation and safety', '✓', 'A planned test workspace for measuring model quality, limitations, consistency and risk indicators.')
      ],
      research: ['Grounded retrieval and source attribution', 'Small and efficient model approaches', 'Robust evaluation and misuse-resistant interfaces'],
      contribution: 'Could bring AI research and responsible-integration methods to parent-company products. These are future concepts, not available AI services or launched products.',
      future: ['Explore source-grounded assistants for bounded tasks.', 'Study evaluation methods that reveal uncertainty and error.', 'Research privacy-aware, human-reviewed automation.'],
      accent: 'gold',
      logo: 'assets/AITECH.png'
    },
    {
      id: 'cybertech',
      name: 'MI CORTEX CYBERTECH',
      identity: 'Cybersecurity & digital protection',
      summary: 'A proposed cybersecurity brand focused on defensive engineering, risk awareness and resilient digital systems.',
      industry: 'Cybersecurity, information security and data protection',
      purpose: 'To help shape security-minded technology concepts and defensive practices for future parent-company products.',
      vision: 'Enable people and organizations to use digital systems with greater confidence and resilience.',
      mission: 'Explore practical defensive security through risk assessment, secure design and clear user guidance.',
      objectives: ['Build security into product planning rather than treat it as an afterthought.', 'Protect confidentiality, integrity and availability of information.', 'Explain findings responsibly and prioritize remediation.'],
      products: [
        { name: 'Cortex Security Desk', category: 'Security operations concept', description: 'A proposed workspace concept for organizing defensive findings, ownership and remediation progress.', features: ['Asset and finding inventories with responsible owners.', 'Risk-prioritized remediation tracking.', 'Audit-friendly notes and status history.'], users: 'Small IT teams and organizations coordinating security work.' },
        { name: 'Cortex Trust Monitor', category: 'Digital protection concept', description: 'A proposed monitoring concept for surfacing configuration drift and operational security signals.', features: ['Policy and configuration checks for authorized systems.', 'Clear alerts with evidence and recommended review steps.', 'Escalation controls that keep a human in the decision loop.'], users: 'System administrators and security-conscious product teams.' }
      ],
      services: [
        { name: 'Security posture review planning', description: 'Define an authorized, scope-limited review of defensive controls and system configuration.', deliverable: 'A review scope, evidence checklist and remediation-oriented report outline.', customers: 'Organizations seeking to understand their defensive readiness.' },
        { name: 'Secure design consultation', description: 'Review a proposed application architecture for authentication, data handling and trust boundaries.', deliverable: 'A threat-model summary and prioritized design recommendations.', customers: 'Software teams planning a new or significantly changed product.' },
        { name: 'Security awareness program design', description: 'Plan role-based educational material around common safe practices and incident reporting.', deliverable: 'A training outline and practical awareness resources.', customers: 'Organizations building internal security awareness.' }
      ],
      operations: 'Planned activities are strictly defensive and authorization-based: security requirements, threat modeling, configuration review, awareness planning and remediation guidance. No unauthorized testing or monitoring is proposed.',
      expertise: ['Secure software design and threat modeling', 'Identity, access and data-protection concepts', 'Defensive configuration and risk management', 'Security education and incident-readiness planning'],
      tools: [
        plannedTool('Security Assessment Tools', 'Defensive assessment', '⬡', 'A proposed, scope-limited workspace for documenting authorized control reviews and remediation priorities.'),
        plannedTool('Network Monitoring Tools', 'Monitoring', '◉', 'A planned dashboard concept for reviewing network-health and security signals from authorized environments.'),
        plannedTool('Vulnerability Management Tools', 'Vulnerability management', '⚠', 'A concept for recording verified findings, ownership, severity and remediation progress.'),
        plannedTool('Security Audit Tools', 'Audit and compliance', '✓', 'A proposed checklist workspace for collecting evidence against selected security requirements.'),
        plannedTool('Encryption Utilities', 'Data protection', '▣', 'A planned utility concept for explaining and managing approved encryption workflows; no cryptographic service is currently offered.'),
        plannedTool('Threat Monitoring Dashboard', 'Threat monitoring', '⌕', 'A concept for organizing defensive alerts and context for human review, not autonomous response.'),
        plannedTool('Security Awareness Tools', 'Security education', '◇', 'A planned learning resource for safe practices, reporting guidance and role-specific awareness material.')
      ],
      research: ['Privacy-preserving security monitoring', 'Practical security patterns for small teams', 'Clear risk communication and remediation workflows'],
      contribution: 'Could help parent-company teams consider security and privacy throughout product design. No security service is currently offered and no certification is claimed.',
      future: ['Develop defensive security checklists for proposed products.', 'Study secure-by-default configuration patterns.', 'Explore accessible ways to track and explain remediation.'],
      accent: 'blue',
      logo: 'assets/CYBERTECH.png'
    },
    {
      id: 'electrotech',
      name: 'MI CORTEX ELECTROTECH',
      identity: 'Electronics & smart systems',
      summary: 'A proposed electronics brand exploring circuits, embedded control and practical smart-device concepts.',
      industry: 'Electronics, electrical engineering and smart electronic systems',
      purpose: 'To investigate electronic systems that can connect physical sensing, control and digital applications.',
      vision: 'Make electronic technology more useful through careful engineering and understandable operation.',
      mission: 'Explore electronic designs with attention to safety, power, reliability and integration.',
      objectives: ['Build a strong foundation in circuit and system requirements.', 'Favor energy-aware and testable designs.', 'Document operating limits and interfaces clearly.'],
      products: [
        { name: 'Cortex Smart Sensor Node', category: 'Connected electronics', description: 'A proposed compact sensor concept for collecting environmental or equipment measurements.', features: ['Interchangeable sensor inputs and calibration planning.', 'Low-power operation and local status indicators.', 'Optional connectivity to a supervised monitoring application.'], users: 'Educators, facilities teams and electronics learners.' },
        { name: 'Cortex Control Board', category: 'Embedded control', description: 'A proposed controller-board concept for prototyping simple monitoring and automation tasks.', features: ['Clearly documented input and output interfaces.', 'Protection and diagnostic concepts appropriate to intended use.', 'Development workflow designed for testing before deployment.'], users: 'Makers, engineers and technical education programs.' }
      ],
      services: [
        { name: 'Electronics requirements planning', description: 'Clarify electrical, environmental, interface and safety requirements for an electronic product idea.', deliverable: 'A requirements brief and initial design constraints.', customers: 'Teams planning a connected device or electronic prototype.' },
        { name: 'Circuit and embedded concept review', description: 'Explore circuit blocks, controller choices and firmware responsibilities at an early design stage.', deliverable: 'A conceptual block diagram and test considerations.', customers: 'Product teams and electronics learners.' },
        { name: 'Device integration planning', description: 'Plan how electronic modules might exchange data with a computer, network or application.', deliverable: 'An interface and integration outline.', customers: 'Organizations combining electronic equipment with digital workflows.' }
      ],
      operations: 'Planned operations include circuit research, component evaluation, firmware concepts, bench-test planning, documentation and safety review. Mains-voltage and regulated electrical work would require appropriately qualified specialists.',
      expertise: ['Analog and digital electronics concepts', 'Microcontrollers and embedded firmware', 'Power, sensing and signal-interface planning', 'Device testing and technical documentation'],
      tools: [
        plannedTool('Circuit Design Tools', 'Circuit design', '⌁', 'A proposed workspace for sketching circuit blocks and documenting component choices and design assumptions.'),
        plannedTool('Electronics Simulation Tools', 'Simulation', '◇', 'A planned environment for exploring circuit behavior in simulation before controlled prototyping.'),
        plannedTool('Electrical Calculation Tools', 'Engineering calculations', '∑', 'A concept calculator for common electrical estimates, with formulas, units and assumptions made visible.'),
        plannedTool('Component Reference Tools', 'Reference', '▤', 'A proposed catalog for organizing component characteristics, datasheet references and selection notes.'),
        plannedTool('PCB Design Tools', 'PCB design', '▦', 'A planned workflow for documenting board layouts, interfaces and manufacturing-readiness checks.'),
        plannedTool('Electronics Testing Tools', 'Testing', '✓', 'A concept for recording bench-test procedures, measurements and review outcomes.'),
        plannedTool('Smart Device Monitoring Tools', 'Connected devices', '◉', 'A proposed interface for viewing status and telemetry from authorized smart-device prototypes.')
      ],
      research: ['Energy-efficient sensing and control', 'Robust interfaces for field devices', 'Modular electronics for learning and prototyping'],
      contribution: 'Could bridge the parent company’s software and hardware ideas through connected electronics concepts. No device is currently available for purchase.',
      future: ['Explore sensor modules for educational and facility use.', 'Investigate reliable low-power embedded designs.', 'Develop safe and repeatable prototype-testing approaches.'],
      accent: 'gold',
      logo: 'assets/ELECTROTECH.png'
    },
    {
      id: 'aerotech',
      name: 'MI CORTEX AEROTECH',
      identity: 'Aerospace research & aviation technology',
      summary: 'A proposed research-led brand exploring aerospace engineering, aviation data and simulation concepts.',
      industry: 'Aerospace technology, aviation-related innovation and engineering research',
      purpose: 'To study aerospace and aviation challenges through responsible engineering research and digital tools.',
      vision: 'Contribute useful, evidence-led ideas to safer and more efficient aerospace systems.',
      mission: 'Explore aerospace concepts through simulation, data analysis and collaboration with qualified specialists where appropriate.',
      objectives: ['Focus on research and simulation before any physical system claims.', 'Respect aviation safety, certification and regulatory requirements.', 'Communicate technical assumptions and limitations transparently.'],
      products: [
        { name: 'Cortex Flight Data Lab', category: 'Aviation analytics concept', description: 'A proposed analytical environment for studying authorized, de-identified flight or operations datasets.', features: ['Dataset quality and provenance checks.', 'Configurable visualization of operational trends.', 'Reproducible analysis notes and exportable summaries.'], users: 'Researchers, educators and aviation-planning teams with lawful data access.' },
        { name: 'Cortex AeroSim Studio', category: 'Engineering simulation concept', description: 'A proposed learning and concept-evaluation environment for simplified aerospace and aerodynamic scenarios.', features: ['Parameter-driven simulation exercises.', 'Visual comparison of modeled scenarios.', 'Clear distinction between educational models and certified engineering tools.'], users: 'Students, educators and early-stage engineering researchers.' }
      ],
      services: [
        { name: 'Aerospace research scoping', description: 'Turn an aerospace question into a bounded research plan with data, assumptions and safety considerations.', deliverable: 'A research brief and a list of validation needs.', customers: 'Education and research teams.' },
        { name: 'Aviation data analysis planning', description: 'Plan responsible analysis of datasets that the requesting organization is authorized to use.', deliverable: 'A data-quality, privacy and visualization plan.', customers: 'Aviation operators, planners and researchers.' },
        { name: 'Simulation concept development', description: 'Outline a simulation or educational model for exploring a non-certified aerospace concept.', deliverable: 'A model scope, variables and limitations document.', customers: 'Academic and early-stage engineering groups.' }
      ],
      operations: 'Planned activities center on literature and requirements research, data analysis, simulation, documentation and expert review. Aircraft design, flight operations and safety-critical engineering require qualified professionals and applicable approvals.',
      expertise: ['Aerospace systems research', 'Aviation data and visualization concepts', 'Simulation and model validation planning', 'Safety, regulatory and certification awareness'],
      tools: [
        plannedTool('Aerospace Design Tools', 'Engineering design', '◇', 'A proposed workspace for capturing early aerospace-system requirements and conceptual design decisions.'),
        plannedTool('Flight Data Analysis Tools', 'Data analysis', '◫', 'A planned environment for examining permitted flight datasets and documenting analysis assumptions.'),
        plannedTool('Aerodynamics Simulation Tools', 'Simulation', '⌁', 'A concept for organizing aerodynamic models and simulation results for research and learning.'),
        plannedTool('Aviation Documentation Tools', 'Documentation', '▤', 'A proposed library for organizing aviation references, project documents and revision records.'),
        plannedTool('Aircraft Performance Analysis Tools', 'Performance analysis', '↗', 'A planned calculator concept for studying aircraft-performance data within clearly stated assumptions.'),
        plannedTool('Aerospace Research Workspace', 'Research', '⌬', 'A concept workspace for tracking research questions, sources, calculations and review notes.'),
        plannedTool('Engineering Calculation Tools', 'Engineering calculations', '∑', 'A planned collection of traceable engineering calculations with units and assumptions shown.')
      ],
      research: ['Operational efficiency and data quality', 'Educational aerospace simulation', 'Responsible use of analytics in aviation contexts'],
      contribution: 'Could add aerospace-domain research themes to the parent company’s digital and engineering portfolio. No aircraft, flight service or certified aerospace product is claimed.',
      future: ['Explore non-operational educational simulation tools.', 'Study authorized aviation data workflows.', 'Identify research opportunities with qualified institutions if future partnerships are established.'],
      accent: 'blue',
      logo: 'assets/AEROTECH.png'
    },
    {
      id: 'edutech',
      name: 'MI CORTEX EDUTECH',
      identity: 'Education technology & digital learning',
      summary: 'A proposed education technology brand for inclusive learning platforms, classroom tools and digital assessment.',
      industry: 'Educational technology, learning platforms and digital education solutions',
      purpose: 'To explore digital tools that help educators organize learning and give learners clearer ways to practice and progress.',
      vision: 'Make high-quality learning experiences more accessible, engaging and adaptable.',
      mission: 'Plan education technology around learner needs, educator workflows, accessibility and responsible data use.',
      objectives: ['Support different learning needs and levels of access.', 'Help educators create, deliver and assess learning activities.', 'Use learner data carefully and transparently.'],
      products: [
        { name: 'Cortex Classroom', category: 'Learning management', description: 'A proposed learning-space concept for lessons, resources, assignments and class communication.', features: ['Organized course materials and assignment workflows.', 'Learner progress views designed for educator review.', 'Mobile-friendly access and accessibility considerations.'], users: 'Schools, tutors, training programs and learners.' },
        { name: 'Cortex Exam Studio', category: 'Assessment and practice', description: 'A proposed assessment-authoring concept for practice quizzes and structured examinations.', features: ['Question banks and reusable assessment templates.', 'Configurable timing, feedback and review settings.', 'Results summaries intended to support learning, not replace educator judgment.'], users: 'Teachers, training providers and students preparing for assessments.' }
      ],
      services: [
        { name: 'Digital learning needs assessment', description: 'Map learner, educator and administrator needs before selecting or planning a digital learning system.', deliverable: 'A stakeholder and learning-workflow plan.', customers: 'Schools, training organizations and education initiatives.' },
        { name: 'Course and assessment design planning', description: 'Structure digital lessons, practice activities and assessments around learning outcomes.', deliverable: 'A course outline, content model and assessment blueprint.', customers: 'Educators, tutors and subject-matter experts.' },
        { name: 'Learning platform implementation planning', description: 'Plan platform roles, content migration, accessibility, privacy and educator onboarding.', deliverable: 'A rollout and training plan; no platform deployment is currently promised.', customers: 'Education administrators and training teams.' }
      ],
      operations: 'Planned work includes learning research, educator consultation, platform and content design, accessibility review and assessment evaluation. Any learner-data processing would need strong safeguards and appropriate institutional approval.',
      expertise: ['Learning-platform and classroom workflow design', 'Digital content and assessment concepts', 'Accessibility and learner experience', 'Privacy-aware education data planning'],
      tools: [
        plannedTool('Online Learning Tools', 'Learning platform', '▣', 'A proposed learning space for organizing digital lessons, activities and learner progress.'),
        plannedTool('Virtual Classroom', 'Classroom collaboration', '◉', 'A planned classroom concept for structured online teaching and learner participation.'),
        plannedTool('Examination Management Tools', 'Assessment', '✓', 'A concept for planning assessments, managing submissions and recording review outcomes.'),
        plannedTool('Quiz Creation Tools', 'Assessment authoring', '?', 'A proposed editor for creating practice questions and organizing quiz content by learning objective.'),
        plannedTool('Student Management Tools', 'Learner administration', '♙', 'A planned workspace for authorized learner records, class grouping and education workflows.'),
        plannedTool('Teacher Workspace', 'Educator productivity', '▤', 'A concept hub for lesson planning, resource organization and class activity preparation.'),
        plannedTool('Attendance Tools', 'Classroom administration', '◷', 'A proposed attendance workflow for recording participation and reviewing class attendance history.'),
        plannedTool('Learning Analytics', 'Learning analytics', '▥', 'A planned reporting concept for understandable learning-progress indicators with privacy safeguards.'),
        plannedTool('Digital Library', 'Digital resources', '▤', 'A proposed catalog for organizing searchable educational resources and reading lists.')
      ],
      research: ['Accessible learning on low-bandwidth devices', 'Formative feedback and practice design', 'Useful progress signals for educators'],
      contribution: 'Could explore education-focused applications and learning experiences for the parent company’s proposed digital ecosystem. No education service is currently offered.',
      future: ['Investigate learner-centered mobile-first classroom experiences.', 'Explore tools for practice, feedback and educator planning.', 'Research accessible content formats and responsible learning analytics.'],
      accent: 'gold',
      logo: 'assets/EDUTECH.png'
    },
    {
      id: 'digitech',
      name: 'MI CORTEX DIGITECH',
      identity: 'Digital transformation & technology solutions',
      summary: 'A proposed digital solutions brand for practical online tools, connected workflows and organizational transformation.',
      industry: 'Digital transformation, digital tools and technology solutions',
      purpose: 'To help frame technology concepts that simplify services, connect information and improve how organizations work.',
      vision: 'Make digital transformation practical, inclusive and aligned with real organizational needs.',
      mission: 'Explore end-to-end digital experiences that combine useful software, clear processes and thoughtful integration.',
      objectives: ['Start from user and operational needs rather than technology trends.', 'Reduce fragmented workflows through considered integration.', 'Plan for accessibility, privacy and ongoing support from the outset.'],
      products: [
        { name: 'Cortex Digital Hub', category: 'Digital services portal', description: 'A proposed configurable portal concept for bringing selected organization services and resources together.', features: ['Role-based access to approved tools and information.', 'Unified navigation with service status and help content.', 'Integration planning for existing organizational systems.'], users: 'Businesses, associations and service organizations.' },
        { name: 'Cortex Workflow Suite', category: 'Process digitization', description: 'A proposed set of workflow tools for replacing manual request, approval and tracking processes.', features: ['Configurable forms and task routing.', 'Status visibility and audit-friendly activity records.', 'Reporting concepts for bottleneck and service analysis.'], users: 'Operations teams seeking clearer, trackable processes.' }
      ],
      services: [
        { name: 'Digital transformation discovery', description: 'Document current workflows, pain points, stakeholders and desired outcomes before proposing technology.', deliverable: 'A prioritized opportunity map and staged roadmap.', customers: 'Organizations planning digital modernization.' },
        { name: 'Platform and portal planning', description: 'Define information architecture, roles, integrations and service journeys for an online platform.', deliverable: 'A portal specification and integration outline.', customers: 'Businesses and institutions planning self-service or internal portals.' },
        { name: 'Workflow digitization planning', description: 'Select a bounded process and plan forms, approvals, notifications and records around it.', deliverable: 'A workflow model and implementation requirements.', customers: 'Administrative and operations teams.' }
      ],
      operations: 'Planned activities include service design, workflow mapping, platform architecture, integration planning, usability review and change-readiness documentation.',
      expertise: ['Digital service and portal design', 'Process mapping and workflow automation', 'System integration and information architecture', 'Adoption, accessibility and service measurement'],
      tools: [
        plannedTool('Digital Workspace', 'Productivity', '▣', 'A proposed hub for organizing projects, shared work and frequently used digital resources.'),
        plannedTool('File Management Tools', 'File organization', '▤', 'A planned interface for structuring, finding and maintaining authorized digital files.'),
        plannedTool('QR Code Tools', 'Digital utilities', '▦', 'A concept for creating and reading QR codes for approved information-sharing use cases.'),
        plannedTool('Digital Productivity Tools', 'Productivity', '◈', 'A proposed collection of lightweight tools for common digital planning and work tasks.'),
        plannedTool('Workflow Automation', 'Workflow automation', '⚙', 'A planned workflow builder for repeatable administrative steps with user review and control.'),
        plannedTool('Document Management', 'Document management', '▤', 'A concept for organizing document versions, metadata and access-aware review workflows.'),
        plannedTool('Digital Business Tools', 'Business operations', '◫', 'A proposed set of utilities for mapping and coordinating routine digital business processes.'),
        plannedTool('Integration Tools', 'System integration', '⇄', 'A planned configuration workspace for documenting approved connections between digital services.')
      ],
      research: ['Human-centered digital public and business services', 'Interoperability and low-friction integrations', 'Responsible automation for administrative tasks'],
      contribution: 'Could connect parent-company products into coherent digital experiences and identify transformation opportunities. This proposed brand is not an operating consultancy.',
      future: ['Explore configurable portals for focused user groups.', 'Develop repeatable workflow-design patterns.', 'Study accessible digital service models for mobile-first use.'],
      accent: 'blue',
      logo: 'assets/DIGITECH.png'
    },
    {
      id: 'innovation',
      name: 'MI CORTEX INNOVATION',
      identity: 'Research, experimentation & new technology',
      summary: 'A proposed research and experimentation brand for testing new ideas before they become product commitments.',
      industry: 'Research and development, experimentation and technology development',
      purpose: 'To provide a disciplined space for exploring emerging technologies and translating evidence into useful concepts.',
      vision: 'Turn curiosity into responsible, tested ideas with clear value and honest limits.',
      mission: 'Design small, evidence-led experiments that inform future parent-company products and research directions.',
      objectives: ['Test assumptions early with measurable questions.', 'Share findings, limitations and negative results clearly.', 'Promote ethical, safe and resource-aware experimentation.'],
      products: [
        { name: 'Cortex Experiment Lab', category: 'Research toolkit concept', description: 'A proposed workspace for recording hypotheses, experiment plans, observations and conclusions.', features: ['Structured experiment notebooks and version history.', 'Evidence capture with source and method notes.', 'Review workflow for assumptions, risks and reproducibility.'], users: 'Product teams, educators and applied researchers.' },
        { name: 'Cortex Idea-to-Prototype', category: 'Innovation pipeline concept', description: 'A proposed framework for moving a selected idea through discovery, feasibility and prototype evaluation.', features: ['Stage gates for user value, feasibility and risk.', 'Lightweight evaluation plans and decision records.', 'Clear handoff from experiment to product planning.'], users: 'Innovation teams and organizations exploring new technology.' }
      ],
      services: [
        { name: 'Research question framing', description: 'Turn a broad opportunity into a focused question, evidence plan and decision threshold.', deliverable: 'A research brief with methods, assumptions and constraints.', customers: 'Product, academic and strategy teams.' },
        { name: 'Technology feasibility exploration', description: 'Compare candidate technologies against needs, maturity, cost and responsible-use considerations.', deliverable: 'A comparative assessment and experiment recommendation.', customers: 'Organizations evaluating an unfamiliar technology.' },
        { name: 'Prototype experiment design', description: 'Plan a small experiment to learn whether a concept warrants further investment.', deliverable: 'A prototype scope, test protocol and evaluation criteria.', customers: 'Teams validating early product concepts.' }
      ],
      operations: 'Planned operations include horizon scanning, research synthesis, experiment design, prototype coordination and evidence reviews. Research output would distinguish measured results from hypotheses.',
      expertise: ['Applied research methods and evidence synthesis', 'Rapid prototyping and experiment design', 'Technology evaluation and readiness', 'Ethical review and reproducibility planning'],
      tools: [
        plannedTool('Research Workspace', 'Research management', '⌬', 'A proposed environment for organizing questions, sources, methods and research notes.'),
        plannedTool('Idea Management Tools', 'Ideation', '✦', 'A planned space for capturing, grouping and evaluating ideas with clear ownership and rationale.'),
        plannedTool('Project Planning Tools', 'Project management', '▤', 'A concept for defining research milestones, dependencies, responsibilities and review points.'),
        plannedTool('Prototype Development Tools', 'Prototyping', '◇', 'A proposed toolkit for documenting prototype requirements, iterations and feedback.'),
        plannedTool('Innovation Tracking', 'Progress tracking', '◉', 'A planned overview for tracking experiments and concepts from exploration through evaluation.'),
        plannedTool('Research Documentation', 'Documentation', '¶', 'A concept for maintaining structured research records, references and reproducibility notes.'),
        plannedTool('Experiment Management', 'Experimentation', '⌁', 'A proposed workflow for recording hypotheses, methods, observations and outcomes.'),
        plannedTool('Technology Evaluation Tools', 'Technology assessment', '✓', 'A planned framework for comparing technology options against transparent criteria and constraints.')
      ],
      research: ['Emerging computing and interaction approaches', 'Energy, accessibility and privacy implications of new systems', 'Methods for validating early-stage digital products'],
      contribution: 'Could help the parent company make better-informed product decisions through structured research and experimentation. It does not claim published research results or partnerships.',
      future: ['Create reusable experiment templates and review practices.', 'Explore collaborative research themes when suitable partners are established.', 'Translate validated findings into scoped product proposals.'],
      accent: 'gold',
      logo: 'assets/INNOVATION.png'
    },
    {
      id: 'autotech',
      name: 'MI CORTEX AUTOTECH',
      identity: 'Automotive systems & intelligent mobility',
      summary: 'A proposed automotive technology brand exploring connected vehicle experiences and mobility-support systems.',
      industry: 'Automotive technology, vehicle-related digital systems and intelligent mobility',
      purpose: 'To investigate digital tools that may improve vehicle ownership, fleet operations and mobility planning without compromising safety.',
      vision: 'Support safer, more informed and more efficient mobility through useful technology.',
      mission: 'Explore automotive software and connected-service concepts with respect for vehicle safety, data protection and regulatory limits.',
      objectives: ['Keep safety-critical vehicle control outside unqualified product scope.', 'Protect vehicle and location data through careful design.', 'Focus on useful information and operational support.'],
      products: [
        { name: 'Cortex Fleet Desk', category: 'Fleet management concept', description: 'A proposed dashboard concept for organizing authorized fleet information and routine maintenance planning.', features: ['Vehicle inventory and service schedule tracking.', 'Operational summaries based on approved data sources.', 'Role-based access and privacy-aware record handling.'], users: 'Small fleet operators and logistics coordinators.' },
        { name: 'Cortex Mobility Companion', category: 'Driver and ownership tools', description: 'A proposed vehicle companion concept for ownership records, reminders and trip-related information.', features: ['Maintenance and document reminders.', 'Optional trip records with explicit user control.', 'Clear separation between informational tools and vehicle controls.'], users: 'Individual vehicle owners and small mobility teams.' }
      ],
      services: [
        { name: 'Fleet technology needs assessment', description: 'Review fleet workflows, data sources and reporting needs to identify suitable digital improvements.', deliverable: 'A fleet-system requirements and integration outline.', customers: 'Small businesses and organizations managing vehicles.' },
        { name: 'Mobility application planning', description: 'Plan user journeys and data requirements for a vehicle or mobility-related application concept.', deliverable: 'A product brief with privacy, safety and usability considerations.', customers: 'Mobility product teams and service operators.' },
        { name: 'Connected vehicle integration study', description: 'Assess lawful, documented vehicle-data interfaces and the boundaries for a non-safety-critical integration.', deliverable: 'A feasibility and risk review; no vehicle modification or control service is currently offered.', customers: 'Organizations exploring connected fleet information.' }
      ],
      operations: 'Planned activities include mobility research, fleet workflow analysis, application design, data-integration review and safety-boundary definition. Any future product would be evaluated against applicable vehicle and data regulations.',
      expertise: ['Fleet and maintenance workflow concepts', 'Connected-device and vehicle-data integration planning', 'Mobility application design', 'Privacy and safety considerations for vehicle systems'],
      tools: [
        plannedTool('Vehicle Information Tools', 'Vehicle records', '▤', 'A proposed workspace for organizing vehicle specifications, ownership records and reference information.'),
        plannedTool('Vehicle Diagnostics', 'Diagnostics', '⌕', 'A planned concept for presenting authorized diagnostic information for human review.'),
        plannedTool('Maintenance Management', 'Maintenance', '⚙', 'A proposed planner for tracking maintenance schedules, service records and reminders.'),
        plannedTool('Automotive Data Analysis', 'Data analysis', '◫', 'A concept for reviewing permitted vehicle or fleet datasets and summarizing operational patterns.'),
        plannedTool('Vehicle Service Management', 'Service operations', '▦', 'A planned workflow for organizing service requests, inspection records and vehicle availability.'),
        plannedTool('Smart Mobility Tools', 'Mobility', '↗', 'A proposed set of digital mobility concepts focused on useful information and user-controlled planning.'),
        plannedTool('Fleet Management', 'Fleet operations', '⇄', 'A planned overview for coordinating fleet records, usage and maintenance status.'),
        plannedTool('Automotive Research Workspace', 'Research', '⌬', 'A concept space for documenting mobility research, requirements and technology evaluations.')
      ],
      research: ['Fleet efficiency and maintenance information', 'Privacy-respecting connected mobility', 'Digital tools for accessible and sustainable transport'],
      contribution: 'Could extend the parent company’s software and connected-device concepts into mobility use cases. No automotive product, vehicle system or service is currently available.',
      future: ['Explore lightweight fleet records and maintenance planning.', 'Study privacy-conscious vehicle data use.', 'Investigate mobility tools that improve information access without controlling safety-critical systems.'],
      accent: 'blue',
      logo: 'assets/AUTOTECH.png'
    }
  ];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const cardById = new Map();
  let activeProfileId = null;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  listingSection.querySelectorAll('.sub-card').forEach((card) => {
    const name = card.querySelector('h3')?.textContent.trim();
    const profile = profiles.find((item) => item.name === name);
    if (!profile) return;
    card.dataset.profileId = profile.id;
    card.href = `#${profile.id}`;
    card.setAttribute('aria-label', `View proposed profile: ${profile.name}`);
    cardById.set(profile.id, card);
  });

  const renderList = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  const renderTools = (tools) => `
    <div class="sub-company-profile__tool-grid">
      ${tools.map((tool) => `
        <article class="sub-company-profile__tool">
          <div class="sub-company-profile__tool-meta">
            <span class="sub-company-profile__tool-icon" aria-hidden="true">${escapeHtml(tool.icon)}</span>
            <span class="sub-company-profile__tool-category">${escapeHtml(tool.category)}</span>
          </div>
          <h4>${escapeHtml(tool.name)}</h4>
          <p>${escapeHtml(tool.description)}</p>
          <span class="sub-company-profile__tool-status" data-status="${escapeHtml(tool.status)}">${escapeHtml(tool.status)}</span>
        </article>`).join('')}
    </div>`;
  const renderProfileNavigation = (profile, direction) => profile
    ? `<a class="sub-company-profile__company-link sub-company-profile__company-link--${direction.toLowerCase()}" href="#${escapeHtml(profile.id)}" data-profile-nav="${escapeHtml(profile.id)}" aria-label="${direction} profile: ${escapeHtml(profile.name)}"><span>${direction}</span><strong>${escapeHtml(profile.name)}</strong></a>`
    : `<span class="sub-company-profile__company-link sub-company-profile__company-link--disabled" aria-disabled="true">${direction === 'Previous' ? 'First profile' : 'Last profile'}</span>`;
  const renderProfile = (profile) => {
    activeProfileId = profile.id;
    const profileIndex = profiles.findIndex((item) => item.id === profile.id);
    const previousProfile = profiles[profileIndex - 1];
    const nextProfile = profiles[profileIndex + 1];
    document.title = `${profile.name} | Sub-Companies | MI CORTEX X INC.`;
    profileContent.innerHTML = `
      <header class="sub-company-profile__hero" data-accent="${escapeHtml(profile.accent)}">
        <div class="sub-company-profile__identity">
          <img class="sub-company-profile__logo" src="${escapeHtml(profile.logo)}" alt="${escapeHtml(profile.name)} logo" />
          <div>
            <p class="sub-company-profile__eyebrow">${escapeHtml(profile.identity)}</p>
            <h2>${escapeHtml(profile.name)}</h2>
            <span class="status-badge">PROPOSED</span>
          </div>
        </div>
        <p class="sub-company-profile__summary">${escapeHtml(profile.summary)}</p>
        <button class="sub-company-profile__back" type="button" data-profile-back>
          <span aria-hidden="true">←</span> Back to Sub-Companies
        </button>
      </header>
      <section class="sub-company-profile__section" aria-labelledby="profile-overview-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">01</span>
          <div><p class="sub-company-profile__eyebrow">Purpose and direction</p><h3 id="profile-overview-title">Company Overview</h3></div>
        </div>
        <div class="sub-company-profile__overview-grid">
          <article class="sub-company-profile__panel"><h4>Identity &amp; specialization</h4><p><strong>Industry:</strong> ${escapeHtml(profile.industry)}.</p><p>${escapeHtml(profile.purpose)}</p></article>
          <article class="sub-company-profile__panel"><h4>Vision</h4><p>${escapeHtml(profile.vision)}</p></article>
          <article class="sub-company-profile__panel"><h4>Mission</h4><p>${escapeHtml(profile.mission)}</p></article>
          <article class="sub-company-profile__panel"><h4>Main objectives</h4>${renderList(profile.objectives)}</article>
        </div>
      </section>
      <section class="sub-company-profile__section" aria-labelledby="profile-products-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">02</span>
          <div><p class="sub-company-profile__eyebrow">Concepts under consideration</p><h3 id="profile-products-title">Planned Products</h3></div>
        </div>
        <div class="sub-company-profile__item-grid">${profile.products.map((product) => `
          <article class="sub-company-profile__item">
            <span class="sub-company-profile__category">${escapeHtml(product.category)}</span>
            <h4>${escapeHtml(product.name)}</h4>
            <p>${escapeHtml(product.description)}</p>
            <h5>Potential capabilities</h5>${renderList(product.features)}
            <p class="sub-company-profile__audience"><strong>Intended users:</strong> ${escapeHtml(product.users)}</p>
            <span class="sub-company-profile__planned-label">Proposed concept · not currently available</span>
          </article>`).join('')}
        </div>
      </section>
      <section class="sub-company-profile__section" aria-labelledby="profile-services-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">03</span>
          <div><p class="sub-company-profile__eyebrow">Future service areas</p><h3 id="profile-services-title">Planned Services</h3></div>
        </div>
        <div class="sub-company-profile__item-grid">${profile.services.map((service) => `
          <article class="sub-company-profile__item sub-company-profile__item--service">
            <h4>${escapeHtml(service.name)}</h4>
            <p>${escapeHtml(service.description)}</p>
            <p><strong>Potential customer outcome:</strong> ${escapeHtml(service.deliverable)}</p>
            <p class="sub-company-profile__audience"><strong>Intended customers:</strong> ${escapeHtml(service.customers)}</p>
            <span class="sub-company-profile__planned-label">Planned area · not currently offered</span>
          </article>`).join('')}
        </div>
      </section>
      <section class="sub-company-profile__section" aria-labelledby="profile-operations-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">04</span>
          <div><p class="sub-company-profile__eyebrow">How the concept may work</p><h3 id="profile-operations-title">Operations &amp; Expertise</h3></div>
        </div>
        <div class="sub-company-profile__operations-grid">
          <article class="sub-company-profile__panel"><h4>Planned activities</h4><p>${escapeHtml(profile.operations)}</p></article>
          <article class="sub-company-profile__panel"><h4>Technology areas</h4>${renderList(profile.expertise)}</article>
          <article class="sub-company-profile__panel"><h4>Research &amp; development</h4>${renderList(profile.research)}</article>
          <article class="sub-company-profile__panel"><h4>Role within MI CORTEX X INC.</h4><p>${escapeHtml(profile.contribution)}</p></article>
        </div>
      </section>
      <section class="sub-company-profile__section" aria-labelledby="profile-tools-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">05</span>
          <div><p class="sub-company-profile__eyebrow">Industry-specific planned capabilities</p><h3 id="profile-tools-title">Tools &amp; Technologies</h3></div>
        </div>
        <p class="sub-company-profile__tools-note">Every tool below is a proposed concept and is not currently available.</p>
        ${renderTools(profile.tools)}
        <article class="sub-company-profile__panel sub-company-profile__technology-panel">
          <h4>Related technology areas</h4>
          ${renderList(profile.expertise)}
        </article>
      </section>
      <section class="sub-company-profile__section" aria-labelledby="profile-future-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">06</span>
          <div><p class="sub-company-profile__eyebrow">Long-term possibilities</p><h3 id="profile-future-title">Future Development</h3></div>
        </div>
        <article class="sub-company-profile__panel sub-company-profile__future-panel">
          <p>These are potential directions for further research and planning, not commitments or launched initiatives.</p>
          ${renderList(profile.future)}
        </article>
      </section>
      <section class="sub-company-profile__section" aria-labelledby="profile-information-title">
        <div class="sub-company-profile__section-heading">
          <span class="sub-company-profile__section-mark" aria-hidden="true">07</span>
          <div><p class="sub-company-profile__eyebrow">Identity and relationship</p><h3 id="profile-information-title">Additional Information</h3></div>
        </div>
        <div class="sub-company-profile__information-grid">
          <article class="sub-company-profile__panel"><h4>Brand identity</h4><p>${escapeHtml(profile.name)} is a proposed technology identity within the MI CORTEX X INC. family, focused on ${escapeHtml(profile.industry.toLowerCase())}.</p></article>
          <article class="sub-company-profile__panel"><h4>Parent company</h4><p>Proposed as a future sub-company concept under MI CORTEX X INC. This page does not represent it as a separate registered or operating company.</p></article>
          <article class="sub-company-profile__panel"><h4>Current status</h4><p><span class="status-badge">PROPOSED</span> Products and services described here are plans and concepts, not currently available offerings.</p></article>
          <article class="sub-company-profile__panel"><h4>Contact</h4><p>No company-specific contact details are published. For general enquiries, visit the <a href="contact.html">MI CORTEX X INC. contact page</a>.</p></article>
        </div>
      </section>
      <div class="sub-company-profile__footer-action">
        <nav class="sub-company-profile__company-nav" aria-label="Sub-Company profile navigation">
          ${renderProfileNavigation(previousProfile, 'Previous')}
          <button class="sub-company-profile__back" type="button" data-profile-back><span aria-hidden="true">←</span> Back to Sub-Companies</button>
          ${renderProfileNavigation(nextProfile, 'Next')}
        </nav>
      </div>`;
    listingHero.hidden = true;
    listingSection.hidden = true;
    profileView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    profileContent.querySelector('[data-profile-back]')?.focus({ preventScroll: true });
  };

  const showListing = ({ replace = false } = {}) => {
    if (replace) history.replaceState(null, '', `${location.pathname}${location.search}`);
    listingHero.hidden = false;
    listingSection.hidden = false;
    profileView.hidden = true;
    profileContent.replaceChildren();
    document.title = 'Sub-Companies | MI CORTEX X INC.';
    window.scrollTo({ top: 0, behavior: 'instant' });
    cardById.get(activeProfileId)?.focus({ preventScroll: true });
    activeProfileId = null;
  };

  const openProfile = (profile, { push = true } = {}) => {
    if (push) {
      history.pushState({ subCompanyProfile: profile.id }, '', `${location.pathname}${location.search}#${profile.id}`);
    }
    renderProfile(profile);
  };

  const logoViewer = document.querySelector('body > [data-logo-viewer]');
  const logoDialog = logoViewer?.querySelector('.sub-company-logo-viewer__dialog');
  const logoStage = logoViewer?.querySelector('[data-logo-stage]');
  const logoImage = logoViewer?.querySelector('[data-logo-image]');
  const logoCompany = logoViewer?.querySelector('[data-logo-company]');
  const logoZoomLabel = logoViewer?.querySelector('[data-logo-zoom]');
  const logoStatus = logoViewer?.querySelector('[data-logo-status]');
  const logoDownload = logoViewer?.querySelector('[data-logo-download]');
  const logoFullscreenButton = logoViewer?.querySelector('[data-logo-action="fullscreen"]');
  const logoImages = Array.from(listingSection.querySelectorAll('img.sub-company-card__logo'));
  let activeLogoIndex = -1;
  let logoZoom = 1;
  let logoFitZoom = 1;
  let logoPanX = 0;
  let logoPanY = 0;
  let logoIsFit = true;
  let logoScrollPosition = 0;
  let previousFocus = null;
  let previousOverflow = null;
  let previousHtmlOverflow = null;
  let previousBackgroundInert = [];
  const logoPointers = new Map();
  let logoDragOrigin = null;
  let logoPinchOrigin = null;

  if (!logoViewer || !logoDialog || !logoStage || !logoImage || !logoCompany || !logoZoomLabel || !logoStatus || !logoDownload || !logoFullscreenButton) {
    throw new Error('Sub-Company logo viewer markup is incomplete.');
  }

  logoImages.forEach((image) => {
    const companyName = image.alt.replace(/\s+logo$/i, '');
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `View ${companyName} logo`);
  });

  const clampLogoPan = () => {
    if (!logoImage.naturalWidth || !logoImage.naturalHeight) return;
    const maxX = Math.max(0, (logoImage.naturalWidth * logoZoom - logoStage.clientWidth) / 2);
    const maxY = Math.max(0, (logoImage.naturalHeight * logoZoom - logoStage.clientHeight) / 2);
    logoPanX = Math.max(-maxX, Math.min(maxX, logoPanX));
    logoPanY = Math.max(-maxY, Math.min(maxY, logoPanY));
  };

  const updateLogoView = () => {
    if (!logoImage.naturalWidth || !logoImage.naturalHeight) return;
    clampLogoPan();
    logoImage.style.width = `${logoImage.naturalWidth * logoZoom}px`;
    logoImage.style.height = `${logoImage.naturalHeight * logoZoom}px`;
    logoImage.style.transform = `translate(calc(-50% + ${logoPanX}px), calc(-50% + ${logoPanY}px))`;
    logoZoomLabel.textContent = `${Math.round(logoZoom * 100)}%`;
  };

  const fitLogoToScreen = () => {
    if (!logoImage.naturalWidth || !logoImage.naturalHeight) return;
    const availableWidth = Math.max(1, logoStage.clientWidth - 48);
    const availableHeight = Math.max(1, logoStage.clientHeight - 48);
    logoFitZoom = Math.min(availableWidth / logoImage.naturalWidth, availableHeight / logoImage.naturalHeight);
    logoZoom = logoFitZoom;
    logoPanX = 0;
    logoPanY = 0;
    logoIsFit = true;
    updateLogoView();
  };

  const setLogoZoom = (value, { fit = false } = {}) => {
    logoZoom = Math.max(0.05, Math.min(10, value));
    logoIsFit = fit;
    if (fit) {
      logoPanX = 0;
      logoPanY = 0;
    }
    updateLogoView();
  };

  const showLogoAt = (index) => {
    activeLogoIndex = (index + logoImages.length) % logoImages.length;
    const selectedLogo = logoImages[activeLogoIndex];
    const source = selectedLogo.currentSrc || selectedLogo.src;
    const filename = decodeURIComponent(new URL(source).pathname.split('/').pop());
    const sameSource = logoImage.src === source;
    logoCompany.textContent = selectedLogo.alt.replace(/\s+logo$/i, '');
    logoImage.alt = selectedLogo.alt;
    logoImage.removeAttribute('style');
    logoDownload.href = source;
    logoDownload.download = filename;
    logoStatus.textContent = '';
    logoZoom = 1;
    logoPanX = 0;
    logoPanY = 0;
    logoIsFit = true;
    logoImage.onload = () => {
      logoImage.onload = null;
      if (!logoViewer.hidden) fitLogoToScreen();
    };
    logoImage.onerror = () => {
      logoImage.onerror = null;
      logoStatus.textContent = `Unable to load ${filename}.`;
    };
    logoImage.src = source;
    if (sameSource && logoImage.complete && logoImage.naturalWidth) logoImage.onload();
  };

  const openLogoViewer = (selectedLogo) => {
    const index = logoImages.indexOf(selectedLogo);
    if (index < 0) return;
    previousFocus = selectedLogo;
    logoScrollPosition = window.scrollY;
    previousOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBackgroundInert = [document.querySelector('body > header'), main, document.querySelector('body > footer')]
      .filter(Boolean)
      .map((element) => ({ element, inert: element.inert }));
    previousBackgroundInert.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    logoViewer.hidden = false;
    logoViewer.setAttribute('aria-hidden', 'false');
    showLogoAt(index);
    logoViewer.querySelector('[data-logo-action="close"]').focus();
  };

  const closeLogoViewer = () => {
    if (logoViewer.hidden) return;
    if (document.fullscreenElement === logoViewer && document.exitFullscreen) {
      document.exitFullscreen();
    }
    logoViewer.hidden = true;
    logoViewer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    previousBackgroundInert.forEach(({ element, inert }) => { element.inert = inert; });
    logoPointers.clear();
    logoDragOrigin = null;
    logoPinchOrigin = null;
    window.scrollTo({ top: logoScrollPosition, behavior: 'instant' });
    previousFocus?.focus({ preventScroll: true });
  };

  const zoomLogoBy = (factor) => {
    logoIsFit = false;
    setLogoZoom(logoZoom * factor);
  };

  logoViewer.addEventListener('click', (event) => {
    const control = event.target.closest('[data-logo-action]');
    if (!control) return;
    const action = control.dataset.logoAction;
    if (action === 'close') {
      closeLogoViewer();
    } else if (action === 'previous') {
      showLogoAt(activeLogoIndex - 1);
    } else if (action === 'next') {
      showLogoAt(activeLogoIndex + 1);
    } else if (action === 'zoom-in') {
      zoomLogoBy(1.2);
    } else if (action === 'zoom-out') {
      zoomLogoBy(1 / 1.2);
    } else if (action === 'fit' || action === 'reset') {
      fitLogoToScreen();
    } else if (action === 'actual') {
      logoPanX = 0;
      logoPanY = 0;
      setLogoZoom(1);
    } else if (action === 'fullscreen') {
      if (document.fullscreenElement === logoViewer) {
        document.exitFullscreen?.();
      } else if (logoViewer.requestFullscreen) {
        logoViewer.requestFullscreen().catch(() => {
          logoStatus.textContent = 'Full-screen mode is unavailable or was blocked by the browser.';
        });
      } else {
        logoStatus.textContent = 'Full-screen mode is not supported by this browser.';
      }
    }
  });

  logoViewer.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement === logoViewer;
    logoFullscreenButton.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
    logoFullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
  });

  logoViewer.addEventListener('wheel', (event) => {
    if (!logoViewer.hidden && event.target.closest('[data-logo-stage]')) {
      event.preventDefault();
      zoomLogoBy(Math.exp(-event.deltaY * 0.001));
    }
  }, { passive: false });

  logoStage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    logoStage.setPointerCapture(event.pointerId);
    logoPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (logoPointers.size === 1) {
      logoDragOrigin = { x: event.clientX, y: event.clientY, panX: logoPanX, panY: logoPanY };
      logoPinchOrigin = null;
    } else if (logoPointers.size === 2) {
      const points = Array.from(logoPointers.values());
      logoPinchOrigin = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        zoom: logoZoom
      };
      logoDragOrigin = null;
    }
    event.preventDefault();
  });

  logoStage.addEventListener('pointermove', (event) => {
    if (!logoPointers.has(event.pointerId)) return;
    logoPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (logoPointers.size === 2 && logoPinchOrigin) {
      const points = Array.from(logoPointers.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      setLogoZoom(logoPinchOrigin.zoom * distance / Math.max(1, logoPinchOrigin.distance));
    } else if (logoPointers.size === 1 && logoDragOrigin) {
      logoPanX = logoDragOrigin.panX + event.clientX - logoDragOrigin.x;
      logoPanY = logoDragOrigin.panY + event.clientY - logoDragOrigin.y;
      updateLogoView();
    }
    event.preventDefault();
  });

  const finishLogoPointer = (event) => {
    logoPointers.delete(event.pointerId);
    logoPinchOrigin = null;
    const remaining = Array.from(logoPointers.values())[0];
    logoDragOrigin = remaining
      ? { x: remaining.x, y: remaining.y, panX: logoPanX, panY: logoPanY }
      : null;
  };
  logoStage.addEventListener('pointerup', finishLogoPointer);
  logoStage.addEventListener('pointercancel', finishLogoPointer);

  logoStage.addEventListener('dblclick', (event) => {
    event.preventDefault();
    if (Math.abs(logoZoom - logoFitZoom) < 0.02) {
      logoPanX = 0;
      logoPanY = 0;
      setLogoZoom(1);
    } else {
      fitLogoToScreen();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (logoViewer.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLogoViewer();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomLogoBy(1.2);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomLogoBy(1 / 1.2);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showLogoAt(activeLogoIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showLogoAt(activeLogoIndex + 1);
    } else if (event.key === 'Tab') {
      const focusable = Array.from(logoDialog.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]'))
        .filter((element) => !element.closest('[hidden]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (logoViewer.hidden || !logoImage.naturalWidth) return;
    if (logoIsFit) fitLogoToScreen();
    else updateLogoView();
  });

  listingSection.addEventListener('click', (event) => {
    const logo = event.target.closest('img.sub-company-card__logo');
    if (logo && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      openLogoViewer(logo);
      return;
    }
    const card = event.target.closest('a[data-profile-id]');
    if (!card || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const profile = profileById.get(card.dataset.profileId);
    if (!profile) return;
    event.preventDefault();
    openProfile(profile);
  });

  listingSection.addEventListener('keydown', (event) => {
    const logo = event.target.closest('img.sub-company-card__logo');
    if (logo && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openLogoViewer(logo);
      return;
    }
    if (event.target.matches('a[data-profile-id]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.target.click();
    }
  });

  profileContent.addEventListener('click', (event) => {
    const profileLink = event.target.closest('a[data-profile-nav]');
    if (profileLink) {
      const profile = profileById.get(profileLink.dataset.profileNav);
      if (!profile) return;
      event.preventDefault();
      openProfile(profile);
      return;
    }
    if (!event.target.closest('[data-profile-back]')) return;
    if (history.state?.subCompanyProfile) {
      history.back();
    } else {
      showListing({ replace: true });
    }
  });

  const renderLocation = () => {
    const profileId = location.hash.slice(1);
    const profile = profileById.get(profileId);
    if (profile) renderProfile(profile);
    else showListing();
  };

  window.addEventListener('popstate', renderLocation);
  const initialProfile = profileById.get(location.hash.slice(1));
  if (initialProfile) openProfile(initialProfile, { push: false });
});
