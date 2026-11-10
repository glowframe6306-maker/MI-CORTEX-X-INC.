document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.querySelector('[data-careers-reservation]');
  const openButton = document.querySelector('[data-careers-reserve]');
  const companyGrid = dialog?.querySelector('[data-reservation-companies]');
  const positionList = dialog?.querySelector('[data-reservation-positions]');
  const selectedCompanyView = dialog?.querySelector('[data-selected-company]');
  const requirementsView = dialog?.querySelector('[data-position-requirements]');
  const searchInput = dialog?.querySelector('[data-position-search]');
  const categoryFilter = dialog?.querySelector('[data-position-category]');
  const agreementInputs = Array.from(dialog?.querySelectorAll('[data-reservation-agreement]') || []);
  const agreementError = dialog?.querySelector('[data-agreement-error]');
  const continueButton = dialog?.querySelector('[data-reservation-continue]');
  const closedNotice = dialog?.querySelector('[data-application-closed]');
  const closedTitle = dialog?.querySelector('[data-application-closed-title]');
  const closedMessage = dialog?.querySelector('[data-application-closed-message]');
  const applicationForm = dialog?.querySelector('[data-application-form]');
  const applicationError = dialog?.querySelector('[data-application-error]');
  const applicationSuccess = dialog?.querySelector('[data-application-success]');
  const submitButton = dialog?.querySelector('[data-application-submit]');
  const documentInput = dialog?.querySelector('[data-application-documents]');
  let serviceStatus = null;

  if (
    !(dialog instanceof HTMLDialogElement)
    || !openButton
    || !companyGrid
    || !positionList
    || !selectedCompanyView
    || !requirementsView
    || !searchInput
    || !categoryFilter
    || agreementInputs.length !== 4
    || !agreementError
    || !continueButton
    || !closedNotice
    || !closedTitle
    || !closedMessage
    || !(applicationForm instanceof HTMLFormElement)
    || !applicationError
    || !applicationSuccess
    || !submitButton
    || !(documentInput instanceof HTMLInputElement)
  ) {
    throw new Error('Careers position explorer is missing required interface elements.');
  }

  const role = (title, track, overview, responsibilities, skills) => ({
    title,
    track,
    overview,
    responsibilities,
    skills
  });

  const companies = [
    {
      id: 'parent',
      name: 'MI CORTEX X INC.',
      logo: 'assets/LOGO.jpg',
      category: 'Parent company',
      description: 'Potential cross-company roles in technology leadership, software, product delivery and organizational support.',
      roles: [
        role('Chief Technology Officer', 'executive', 'Guide technology strategy and technical governance across the parent company and its proposed business areas.', ['Set technology direction and review major architecture decisions.', 'Coordinate responsible engineering practices and long-term technical planning.'], ['Technology strategy', 'Architecture governance', 'Risk and roadmap planning']),
        role('Research and Technology Director', 'executive', 'Coordinate research priorities and evaluate opportunities for responsible technology development.', ['Establish research themes and assess proposed initiatives.', 'Review technical findings and communicate recommendations to leadership.'], ['Research planning', 'Technical evaluation', 'Executive communication']),
        role('Software Engineer', 'software', 'Design, implement and maintain software systems that support approved company products and internal workflows.', ['Develop and review software against documented requirements.', 'Test changes, document interfaces and support maintenance.'], ['Programming fundamentals', 'Testing and debugging', 'Version control']),
        role('Digital Product Manager', 'manager', 'Coordinate product discovery and delivery across approved digital products and services.', ['Translate user and business needs into prioritized product plans.', 'Coordinate design, engineering and quality activities.'], ['Product planning', 'Requirements analysis', 'Cross-functional coordination']),
        role('Operations and Administration Coordinator', 'support', 'Support organized administrative and operational processes as the company grows.', ['Maintain accurate records and coordinate routine office workflows.', 'Support scheduling, document preparation and internal communication.'], ['Organization', 'Document handling', 'Office productivity tools'])
      ]
    },
    {
      id: 'aerotech',
      name: 'MI CORTEX AEROTECH',
      logo: 'assets/AEROTECH.png',
      category: 'Aerospace technology and aviation research',
      description: 'Potential research and engineering work involving aerospace systems, aviation technology and flight data.',
      roles: [
        role('Aerospace Systems Engineer', 'engineering', 'Explore aerospace system concepts and their technical requirements within an appropriately qualified engineering context.', ['Document system requirements and interface assumptions.', 'Support engineering reviews and traceability of design decisions.'], ['Systems engineering', 'Requirements documentation', 'Engineering analysis']),
        role('Aviation Software Developer', 'software', 'Develop software concepts and applications for aviation-related data and engineering workflows.', ['Implement and test software against defined use cases.', 'Document data handling, interfaces and system limitations.'], ['Programming', 'Data processing', 'Software verification']),
        role('Flight Data Analyst', 'analyst', 'Analyze authorized flight-related datasets to support research questions and engineering studies.', ['Prepare datasets and document analysis methods.', 'Communicate findings with appropriate context and limitations.'], ['Data analysis', 'Statistical reasoning', 'Technical reporting']),
        role('Aerodynamics Researcher', 'researcher', 'Support research into aerodynamic concepts using documented methods and suitable models.', ['Review relevant research and define study questions.', 'Record assumptions, methods and reproducible results.'], ['Research methods', 'Numerical or experimental analysis', 'Technical writing']),
        role('Engineering Technical Support Officer', 'support', 'Support engineering teams through documentation, coordination and technical record maintenance.', ['Organize technical documentation and equipment records.', 'Assist with routine coordination and reporting tasks.'], ['Technical documentation', 'Attention to detail', 'Team communication'])
      ]
    },
    {
      id: 'aitech',
      name: 'MI CORTEX AITECH',
      logo: 'assets/AITECH.png',
      category: 'Artificial intelligence and machine learning',
      description: 'Potential AI research and development work spanning machine learning, data, language technologies and evaluation.',
      roles: [
        role('Machine Learning Engineer', 'engineering', 'Develop and evaluate machine-learning systems for approved, clearly scoped applications.', ['Prepare model pipelines and evaluate performance against suitable criteria.', 'Document data assumptions, limitations and reproducibility.'], ['Machine-learning fundamentals', 'Data preparation', 'Model evaluation']),
        role('AI Application Developer', 'software', 'Build software applications that integrate AI capabilities with appropriate safeguards and user controls.', ['Implement application features and reliable integrations.', 'Test outputs and document safe-use limitations.'], ['Application development', 'API integration', 'Testing']),
        role('AI Research Scientist', 'researcher', 'Investigate AI methods and communicate evidence about their capabilities and limitations.', ['Review literature and formulate research questions.', 'Design evaluations and document findings transparently.'], ['AI research methods', 'Experimental design', 'Technical communication']),
        role('Data Scientist', 'analyst', 'Use data analysis and statistical methods to help evaluate proposed AI and business questions.', ['Prepare data and select appropriate analytical methods.', 'Present findings with uncertainty and limitations.'], ['Statistics', 'Data analysis', 'Visualization']),
        role('AI Model Evaluation Specialist', 'analyst', 'Assess model behavior, quality and potential risks through structured evaluation.', ['Design test cases and review model outcomes.', 'Record evaluation findings and recommend mitigations.'], ['Test design', 'Evaluation metrics', 'Clear reporting'])
      ]
    },
    {
      id: 'autotech',
      name: 'MI CORTEX AUTOTECH',
      logo: 'assets/AUTOTECH.png',
      category: 'Automotive technology and intelligent mobility',
      description: 'Potential work involving automotive systems, vehicle data, diagnostics and intelligent mobility research.',
      roles: [
        role('Automotive Systems Engineer', 'engineering', 'Study vehicle-system requirements and integration concepts for future automotive technology.', ['Document system interfaces and engineering assumptions.', 'Support structured design and verification reviews.'], ['Systems engineering', 'Automotive fundamentals', 'Technical documentation']),
        role('Automotive Software Developer', 'software', 'Develop software concepts for automotive information and mobility applications.', ['Implement and test application features.', 'Document data sources, interfaces and operational limits.'], ['Software development', 'Data integration', 'Testing']),
        role('Vehicle Diagnostics Specialist', 'engineering', 'Explore diagnostic workflows and interpret vehicle-system information within authorized and safe contexts.', ['Review diagnostic information and document findings.', 'Follow applicable safety procedures and escalation paths.'], ['Diagnostic methods', 'Technical troubleshooting', 'Safety awareness']),
        role('Mobility Data Analyst', 'analyst', 'Analyze suitable mobility datasets to support research and system planning.', ['Validate datasets and conduct documented analyses.', 'Communicate trends and data limitations.'], ['Data analysis', 'Statistical reasoning', 'Reporting']),
        role('Fleet Technology Support Officer', 'support', 'Support future fleet-technology workflows through coordination and clear record keeping.', ['Maintain service and system records.', 'Coordinate technical requests and routine follow-up.'], ['Organization', 'Customer communication', 'Digital tools'])
      ]
    },
    {
      id: 'codex',
      name: 'MI CORTEX CODEX',
      logo: 'assets/CODEX.png',
      category: 'Software engineering and digital platforms',
      description: 'Potential software development work across web, mobile, backend, APIs and quality assurance.',
      roles: [
        role('Software Engineer', 'software', 'Design, build and maintain software components for approved digital products.', ['Implement features from documented requirements.', 'Review, test and document code changes.'], ['Programming fundamentals', 'Testing and debugging', 'Version control']),
        role('Frontend Developer', 'software', 'Build accessible, responsive user interfaces for web-based products.', ['Implement interface components and user flows.', 'Check responsive behavior and accessibility.'], ['HTML and CSS', 'JavaScript or equivalent', 'Responsive design']),
        role('Backend and API Developer', 'software', 'Develop server-side application logic and documented APIs for approved services.', ['Implement API endpoints and validation.', 'Write tests and maintain technical documentation.'], ['Server-side development', 'API design', 'Data validation']),
        role('Software Quality Analyst', 'analyst', 'Evaluate software behavior and help teams identify defects and quality risks.', ['Create test plans and execute functional checks.', 'Record reproducible issues and verify fixes.'], ['Test design', 'Defect reporting', 'Analytical thinking']),
        role('UI/UX Designer', 'design', 'Research user needs and develop clear, usable interface concepts for digital products.', ['Create user flows, wireframes and interface specifications.', 'Gather feedback and document design decisions.'], ['Interaction design', 'Prototyping', 'Portfolio of relevant work'])
      ]
    },
    {
      id: 'cybertech',
      name: 'MI CORTEX CYBERTECH',
      logo: 'assets/CYBERTECH.png',
      category: 'Cybersecurity and digital protection',
      description: 'Potential defensive security research and development focused on information protection and secure systems.',
      roles: [
        role('Cybersecurity Researcher', 'researcher', 'Study defensive cybersecurity methods and communicate relevant findings responsibly.', ['Review security research and define scoped study questions.', 'Document methods, findings and responsible disclosure considerations.'], ['Security fundamentals', 'Research methods', 'Responsible reporting']),
        role('Information Security Analyst', 'analyst', 'Help assess information security processes and document risk observations.', ['Review documented controls and evidence.', 'Prepare clear findings and track remediation status.'], ['Risk analysis', 'Security documentation', 'Analytical writing']),
        role('Network Security Engineer', 'engineering', 'Support secure network design and defensive monitoring concepts.', ['Review network requirements and security controls.', 'Document configuration standards and monitoring needs.'], ['Networking fundamentals', 'Defensive security', 'Systems documentation']),
        role('Security Software Developer', 'software', 'Develop software that supports defensive security and information protection.', ['Build and test security-focused software features.', 'Apply secure development practices and maintain documentation.'], ['Secure coding', 'Software testing', 'Security fundamentals']),
        role('Security Awareness Coordinator', 'support', 'Help prepare clear security awareness materials and coordinate training activities.', ['Develop and maintain educational resources.', 'Coordinate sessions and collect non-sensitive program feedback.'], ['Communication', 'Digital content tools', 'Training coordination'])
      ]
    },
    {
      id: 'digitech',
      name: 'MI CORTEX DIGITECH',
      logo: 'assets/DIGITECH.png',
      category: 'Digital solutions and transformation',
      description: 'Potential digital product and transformation work involving cloud systems, workflows and integrations.',
      roles: [
        role('Digital Solutions Engineer', 'engineering', 'Design and evaluate digital solution concepts for documented organizational needs.', ['Translate workflow needs into solution requirements.', 'Coordinate implementation reviews and technical documentation.'], ['Systems thinking', 'Requirements analysis', 'Integration concepts']),
        role('Cloud Systems Specialist', 'engineering', 'Support the evaluation and operation planning of cloud-based systems.', ['Document infrastructure requirements and operational controls.', 'Review reliability, access and monitoring needs.'], ['Cloud fundamentals', 'Systems administration', 'Documentation']),
        role('Workflow Automation Developer', 'software', 'Build and test automation concepts that reduce repetitive digital workflow tasks.', ['Map processes and implement appropriate automation.', 'Test exception handling and document maintenance needs.'], ['Programming or automation tools', 'Process analysis', 'Testing']),
        role('Digital Product Manager', 'manager', 'Coordinate research and delivery planning for digital products and transformation initiatives.', ['Prioritize product needs and coordinate contributors.', 'Track delivery risks, outcomes and feedback.'], ['Product planning', 'Stakeholder coordination', 'Project delivery']),
        role('Integration Support Officer', 'support', 'Coordinate technical integration requests and maintain clear service records.', ['Gather integration requirements and route technical questions.', 'Maintain records and coordinate follow-up.'], ['Communication', 'Process coordination', 'Digital systems literacy'])
      ]
    },
    {
      id: 'edutech',
      name: 'MI CORTEX EDUTECH',
      logo: 'assets/EDUTECH.png',
      category: 'Educational technology and digital learning',
      description: 'Potential education technology work in digital learning platforms, content, assessment and learning research.',
      roles: [
        role('Learning Platform Developer', 'software', 'Develop digital learning platform features in collaboration with educators and product teams.', ['Implement and test learning workflows.', 'Consider accessibility and document platform behavior.'], ['Web or application development', 'Testing', 'Accessibility awareness']),
        role('Learning Experience Designer', 'design', 'Design inclusive learning experiences and content structures for digital environments.', ['Map learner needs and develop learning flows.', 'Prototype content and evaluate usability.'], ['Learning design', 'Content structure', 'Portfolio or sample work']),
        role('Education Researcher', 'researcher', 'Support research into digital learning methods and educational technology.', ['Review relevant research and define evaluation questions.', 'Document study methods and findings responsibly.'], ['Research methods', 'Education or relevant domain knowledge', 'Technical writing']),
        role('Digital Education Content Specialist', 'design', 'Prepare clear, accessible educational content for future digital learning products.', ['Develop and review learning materials.', 'Coordinate subject-matter input and content revisions.'], ['Writing and editing', 'Digital content tools', 'Relevant subject knowledge']),
        role('Education Systems Support Officer', 'support', 'Help users and internal teams with future education technology workflows.', ['Document support requests and provide approved guidance.', 'Maintain accurate platform and process records.'], ['Communication', 'Troubleshooting', 'Education technology awareness'])
      ]
    },
    {
      id: 'electrotech',
      name: 'MI CORTEX ELECTROTECH',
      logo: 'assets/ELECTROTECH.png',
      category: 'Electrical engineering and electronic systems',
      description: 'Potential engineering and research work involving circuits, embedded systems and smart devices.',
      roles: [
        role('Electrical Engineer', 'engineering', 'Contribute to electrical system concepts and technical reviews within applicable safety requirements.', ['Prepare and review electrical design documentation.', 'Support testing plans and engineering risk reviews.'], ['Electrical engineering fundamentals', 'Design documentation', 'Safety awareness']),
        role('Electronics Design Engineer', 'engineering', 'Explore electronic circuit and device designs for potential products and prototypes.', ['Develop and review circuit concepts.', 'Document component selection and verification needs.'], ['Electronics design', 'Circuit analysis', 'Prototyping']),
        role('Embedded Systems Developer', 'software', 'Develop firmware and software concepts for embedded electronic systems.', ['Implement and test embedded software features.', 'Document interfaces, constraints and system behavior.'], ['C/C++ or equivalent', 'Embedded systems', 'Hardware/software integration']),
        role('PCB Design Technician', 'engineering', 'Prepare and review printed circuit board layouts based on engineering requirements.', ['Create and update PCB design files.', 'Check design rules and maintain revision records.'], ['PCB tools', 'Electronics fundamentals', 'Technical drawings']),
        role('Electronics Test Analyst', 'analyst', 'Support structured testing and documentation for electronic components and systems.', ['Execute documented test procedures.', 'Record measurements and report deviations.'], ['Test methods', 'Measurement awareness', 'Technical reporting'])
      ]
    },
    {
      id: 'hardtech',
      name: 'MI CORTEX HARDTECH',
      logo: 'assets/HARDTECH.png',
      category: 'Computer hardware and systems engineering',
      description: 'Potential hardware research and engineering across computer systems, components and diagnostics.',
      roles: [
        role('Computer Hardware Engineer', 'engineering', 'Evaluate computer hardware concepts and system requirements for future products.', ['Compare system configurations against use cases.', 'Document component choices and verification needs.'], ['Computer architecture', 'Hardware evaluation', 'Technical documentation']),
        role('Systems Architect', 'engineering', 'Develop system-level hardware and software architecture concepts.', ['Map requirements to system components and interfaces.', 'Review scalability, reliability and maintenance considerations.'], ['Systems architecture', 'Technical analysis', 'Architecture documentation']),
        role('Hardware Diagnostics Technician', 'support', 'Assist with structured hardware diagnostics and accurate technical records.', ['Follow documented diagnostic and safety procedures.', 'Record observations and escalate unresolved issues.'], ['Hardware fundamentals', 'Troubleshooting', 'Careful record keeping']),
        role('Device Compatibility Analyst', 'analyst', 'Evaluate component and device compatibility for planned hardware configurations.', ['Review specifications and compatibility criteria.', 'Maintain test results and configuration references.'], ['Component research', 'Analytical thinking', 'Technical reporting']),
        role('Hardware Researcher', 'researcher', 'Explore hardware technology trends and prototype concepts for future development.', ['Review technical literature and market needs.', 'Document research questions, methods and findings.'], ['Research methods', 'Hardware knowledge', 'Technical communication'])
      ]
    },
    {
      id: 'innovation',
      name: 'MI CORTEX INNOVATION',
      logo: 'assets/INNOVATION.png',
      category: 'Research, experimentation and technology development',
      description: 'Potential cross-disciplinary research, prototyping and innovation planning.',
      roles: [
        role('Research and Development Researcher', 'researcher', 'Investigate technology questions and support early-stage research and development work.', ['Formulate scoped research questions and review evidence.', 'Document methods, outcomes and potential next steps.'], ['Research design', 'Critical analysis', 'Technical communication']),
        role('Prototype Development Engineer', 'engineering', 'Translate selected concepts into testable prototypes and technical evaluations.', ['Define prototype requirements and build plans.', 'Test concepts and record limitations and results.'], ['Prototyping', 'Engineering fundamentals', 'Experiment documentation']),
        role('Innovation Project Manager', 'manager', 'Coordinate exploratory projects from concept through documented review milestones.', ['Plan project scope, milestones and contributors.', 'Track risks and summarize evidence for decisions.'], ['Project management', 'Facilitation', 'Risk tracking']),
        role('Product Research Analyst', 'analyst', 'Research user needs, technology options and product concepts.', ['Gather and synthesize relevant research.', 'Prepare evidence-based opportunity summaries.'], ['Research synthesis', 'Data analysis', 'Clear reporting']),
        role('Research Documentation Specialist', 'support', 'Support consistent research records and knowledge organization.', ['Edit and organize research documentation.', 'Maintain references, version records and approved templates.'], ['Technical writing', 'Information organization', 'Document tools'])
      ]
    },
    {
      id: 'robotech',
      name: 'MI CORTEX ROBOTECH',
      logo: 'assets/ROBOTECH.png',
      category: 'Robotics, automation and intelligent machines',
      description: 'Potential robotics work across intelligent machines, automation, sensors and system testing.',
      roles: [
        role('Robotics Engineer', 'engineering', 'Design and evaluate robotics system concepts and their hardware/software interfaces.', ['Develop system requirements and integration plans.', 'Support prototyping, testing and safety reviews.'], ['Robotics fundamentals', 'Systems integration', 'Safety awareness']),
        role('Robot Programmer', 'software', 'Develop software and control logic for robotics prototypes and simulations.', ['Implement and test robot behaviors in approved environments.', 'Document control logic and test outcomes.'], ['Programming', 'Control concepts', 'Simulation tools']),
        role('Automation Engineer', 'engineering', 'Explore automation concepts for suitable processes and technical systems.', ['Map workflows and identify automation requirements.', 'Evaluate system behavior and failure handling.'], ['Automation fundamentals', 'Systems analysis', 'Testing']),
        role('Sensor Systems Researcher', 'researcher', 'Study sensor technologies and their application in robotics and intelligent systems.', ['Compare sensor capabilities and limitations.', 'Design and document suitable research evaluations.'], ['Sensor fundamentals', 'Research methods', 'Data interpretation']),
        role('Robot Systems Test Technician', 'support', 'Support repeatable testing of robotics prototypes and related systems.', ['Run approved test procedures and capture observations.', 'Maintain test records and report anomalies.'], ['Technical testing', 'Attention to detail', 'Safety procedures'])
      ]
    }
  ];

  const trackDetails = {
    executive: {
      category: 'C-Level and Executive Leadership',
      education: 'Relevant education or professional learning in the field may be useful. Requirements would depend on the approved role; equivalent expertise may be considered.',
      qualifications: 'Substantial, relevant senior leadership and governance experience would normally be expected for an executive-level role.',
      experience: 'Extensive relevant leadership experience, strategic responsibility and evidence of organizational decision-making would be expected.',
      leadership: 'High-level organizational leadership, accountability and cross-functional decision-making would be central to the role.',
      communication: 'Strong executive communication, collaboration and stakeholder-management skills would be expected.',
      additional: 'Any appointment would require an approved organizational structure, authority, scope and conflict-of-interest review.'
    },
    director: {
      category: 'Directors and Senior Leadership',
      education: 'Relevant senior-level education, professional learning or equivalent field expertise may be considered; requirements depend on the approved scope.',
      qualifications: 'Role-related professional credentials may be useful but are not confirmed requirements.',
      experience: 'Substantial experience in the relevant function, strategic planning and cross-team delivery would normally be expected.',
      leadership: 'Set direction for the relevant function, support accountable decision-making and coordinate with approved company leadership.',
      communication: 'Clear executive reporting, stakeholder communication and collaborative decision-making would be expected.',
      additional: 'Reporting lines, authority, regional scope and organizational appointments remain subject to official approval.'
    },
    manager: {
      category: 'Managers',
      education: 'Relevant education, professional training or equivalent demonstrated capability may be considered; a university degree is not assumed for every role.',
      qualifications: 'Role-relevant project, product or management qualifications may be useful but are not established requirements.',
      experience: 'Relevant project or operational experience would be expected. The scope would depend on the approved team and responsibilities.',
      leadership: 'Planning, prioritization and team coordination would be relevant; direct people-management experience may be required only if the role includes staff supervision.',
      communication: 'Clear written and verbal communication, teamwork and stakeholder coordination would be expected.',
      additional: 'Specific authority, reporting lines and performance responsibilities require company approval.'
    },
    supervisor: {
      category: 'Supervisors and Team Leaders',
      education: 'Relevant vocational learning, technical education or equivalent practical capability may be considered.',
      qualifications: 'Role-related safety, quality or supervisory training may be relevant to approved duties.',
      experience: 'Practical experience in the relevant work area and the ability to coordinate day-to-day activities may be expected.',
      leadership: 'Organize team tasks, support safe working practices and escalate issues; formal line-management authority is not assumed.',
      communication: 'Clear work instructions, reliable handovers, constructive feedback and teamwork would be expected.',
      additional: 'Shift, site and safety responsibilities require approval and appropriate training.'
    },
    engineering: {
      category: 'Engineers and Technical Professionals',
      education: 'Relevant engineering or technical education, vocational training or equivalent demonstrable skills may be considered. A degree or professional licence would be required only where the approved duties or applicable rules require it.',
      qualifications: 'Relevant technical certifications or professional registration may be requested for specific regulated duties.',
      experience: 'Relevant project, practical or laboratory experience may be useful. Entry-level pathways may be considered for suitable roles.',
      leadership: 'Leadership is not assumed; collaboration with engineering, product and research colleagues would be important.',
      communication: 'Technical documentation, teamwork and clear communication of assumptions and limitations would be expected.',
      additional: 'Applicable safety standards, engineering codes and any required authorization would need to be confirmed for each approved role.'
    },
    software: {
      category: 'Software Developers and Digital Professionals',
      education: 'Relevant software education, training or equivalent practical capability may be considered. A university degree is not assumed.',
      qualifications: 'Role-specific software or platform certifications may be useful but are not established requirements.',
      experience: 'Relevant software projects, practical experience or a strong portfolio may demonstrate capability. Entry-level applicants may be considered where appropriate.',
      leadership: 'Leadership is not assumed unless the approved position includes technical or team leadership.',
      communication: 'Code review, documentation, teamwork and clear discussion of technical trade-offs would be expected.',
      additional: 'Work would follow approved development, accessibility, privacy and security practices.'
    },
    researcher: {
      category: 'Researchers and Scientists',
      education: 'Relevant subject knowledge, research training or equivalent experience may be considered. Formal academic requirements would depend on the approved research scope.',
      qualifications: 'Research methods, domain-specific or laboratory certifications may be relevant to particular projects.',
      experience: 'Research, experimentation, literature review or evidence-based project experience would be relevant; requirements would vary by level.',
      leadership: 'Research leadership is not assumed unless the approved role includes supervision or program direction.',
      communication: 'Careful technical writing, collaboration and transparent communication of uncertainty and limitations would be expected.',
      additional: 'Research ethics, data governance and any required safety or institutional approvals would apply where relevant.'
    },
    analyst: {
      category: 'Analysts and Specialists',
      education: 'Relevant analytical, technical or domain education, training or equivalent demonstrated capability may be considered.',
      qualifications: 'Role-specific analysis, quality, diagnostic or professional certifications may be useful where relevant.',
      experience: 'Relevant analytical, diagnostic, testing or specialist experience may be requested based on the approved role.',
      leadership: 'Leadership is not assumed; reliable collaboration and escalation of findings would be important.',
      communication: 'Accurate record keeping and clear explanations of evidence, methods and limitations would be expected.',
      additional: 'Access to sensitive or regulated information would require approved controls and role-specific authorization.'
    },
    specialist: {
      category: 'Specialists and Subject-Matter Professionals',
      education: 'Relevant subject education, professional training or equivalent demonstrated capability may be considered.',
      qualifications: 'Role-specific credentials may be useful; any mandatory licence would be confirmed only for an approved position.',
      experience: 'Relevant subject-matter, project or practical experience would be considered according to the final role scope.',
      leadership: 'Leadership is not assumed unless the position includes a defined advisory or supervisory responsibility.',
      communication: 'Explain specialist findings clearly, document work and collaborate with related disciplines.',
      additional: 'Any access to regulated systems, data or equipment requires authorization and role-specific controls.'
    },
    quality: {
      category: 'Quality Assurance and Testing',
      education: 'Relevant technical, software, engineering or quality-related education and equivalent practical experience may be considered.',
      qualifications: 'Testing, quality-management or domain-specific certifications may be useful but are not established requirements.',
      experience: 'Testing, inspection, verification, defect analysis or quality-process experience may be relevant.',
      leadership: 'Leadership is not assumed unless the approved position includes test coordination or quality governance.',
      communication: 'Document test methods and results precisely and communicate defects, limitations and risks constructively.',
      additional: 'Approved quality criteria, tools, safety procedures and release authority must be defined before the role is active.'
    },
    technician: {
      category: 'Technicians and Technical Support',
      education: 'Relevant technical or vocational education, training or equivalent practical capability may be considered.',
      qualifications: 'Role-specific equipment, laboratory or safety training may be relevant to approved duties.',
      experience: 'Hands-on technical experience, training or suitable entry-level practice may be considered.',
      leadership: 'Leadership is not assumed; follow approved procedures and seek supervision where required.',
      communication: 'Maintain accurate technical records and communicate equipment or test issues promptly.',
      additional: 'Work with equipment only after appropriate authorization, training and safety controls are in place.'
    },
    entry: {
      category: 'Entry-Level and Early-Career Roles',
      education: 'Relevant school, vocational, academic or practical learning may be considered according to the approved role.',
      qualifications: 'No unlisted credential is assumed; any required qualification would be stated in an official vacancy.',
      experience: 'Relevant projects, coursework, internships, volunteering or transferable skills may be considered; prior employment is not assumed.',
      leadership: 'Leadership experience is not assumed; willingness to learn, reliability and responsible collaboration are relevant.',
      communication: 'Clear communication, feedback readiness and teamwork would be expected.',
      additional: 'Any internship, trainee or graduate pathway would require approved supervision, eligibility and program terms.'
    },
    design: {
      category: 'Designers and Creative Professionals',
      education: 'Relevant design, content or subject training, education or equivalent demonstrable skills may be considered.',
      qualifications: 'Role-specific design or content credentials may be useful but are not established requirements.',
      experience: 'Relevant project experience or a portfolio of work may be requested depending on the role.',
      leadership: 'Leadership is not assumed unless the approved position includes design direction or team supervision.',
      communication: 'User-focused communication, feedback collaboration and clear presentation of design decisions would be expected.',
      additional: 'Applicants should only share portfolio material they own or are authorized to provide.'
    },
    designer: {
      category: 'Designers and Creative Professionals',
      education: 'Relevant design, content or subject training, education or equivalent demonstrable skills may be considered.',
      qualifications: 'Role-specific design or content credentials may be useful but are not established requirements.',
      experience: 'Relevant project experience or a portfolio of work may be requested depending on the role.',
      leadership: 'Leadership is not assumed unless the approved position includes design direction or team supervision.',
      communication: 'User-focused communication, feedback collaboration and clear presentation of design decisions would be expected.',
      additional: 'Applicants should only share portfolio material they own or are authorized to provide.'
    },
    support: {
      category: 'Administrative, Technical and Support Professionals',
      education: 'Relevant school, vocational or professional learning and demonstrated practical skills may be considered. A university degree is not assumed.',
      qualifications: 'Role-specific safety, technical or administrative certificates may be relevant depending on the duties.',
      experience: 'Relevant practical, volunteer, internship or customer-support experience may be useful; entry-level consideration may be possible.',
      leadership: 'Leadership is not assumed unless supervisory duties are part of the approved role.',
      communication: 'Professional communication, teamwork, reliability and accurate record keeping would be expected.',
      additional: 'Any access to equipment, customer information or internal systems would require approved training and authorization.'
    }
  };

  const selectionStages = [
    'Official vacancy announcement and confirmation that the role is approved.',
    'Eligibility and relevant qualification review.',
    'Role-specific technical, professional or practical assessment, if applicable.',
    'Interview or further assessment, where applicable.',
    'Final decision and any formal offer through approved channels.'
  ];
  const supportingDocuments = [
    'A current CV or resume in PDF format may be attached to a future application.',
    'Education or professional qualification evidence may be requested where relevant to the position.',
    'A portfolio or work samples may be relevant for design, software, research or project-based roles; PDF only.',
    'Up to 3 PDF documents, each no larger than 10 MB, may be attached; files are stored privately and are not malware-scanned.'
  ];

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  if (!window.CAREERS_CATALOGUE || !Array.isArray(window.CAREERS_CATALOGUE.companies)) {
    throw new Error('The approved Careers position catalogue failed to load.');
  }
  const excludedTitles = new Set(window.CAREERS_CATALOGUE.excludedTitles.map((title) => title.toLocaleUpperCase('en')));
  const createCatalogueRole = (item, company) => role(
    item.title,
    item.track,
    `${item.title} is a proposed role supporting ${company.name} in ${company.category}. Its approved scope, authority and outcomes would be defined in an official vacancy.`,
    [
      `Carry out the approved ${item.title.toLocaleLowerCase('en')} responsibilities for ${company.name}.`,
      `Coordinate with relevant colleagues and stakeholders in ${company.category}.`,
      'Document decisions, progress, risks and results using approved processes.'
    ],
    [
      `Role-specific ${item.title.toLocaleLowerCase('en')} knowledge`,
      `${company.category} fundamentals`,
      'Professional communication, documentation and teamwork'
    ]
  );
  window.CAREERS_CATALOGUE.companies.forEach((catalogueCompany) => {
    const company = companies.find((item) => item.id === catalogueCompany.id);
    if (!company) throw new Error(`Unknown company in Careers catalogue: ${catalogueCompany.id}`);
    const existing = new Set(company.roles.map((item) => item.title.toLocaleUpperCase('en')));
    catalogueCompany.positions.forEach((position) => {
      if (excludedTitles.has(position.title.toLocaleUpperCase('en'))) return;
      if (!trackDetails[position.track]) {
        throw new Error(`Missing requirements profile for ${position.title} (${position.track}).`);
      }
      if (!existing.has(position.title.toLocaleUpperCase('en'))) {
        company.roles.push(createCatalogueRole(position, catalogueCompany));
        existing.add(position.title.toLocaleUpperCase('en'));
      }
    });
  });

  const categories = [...new Set(companies.flatMap((company) => company.roles.map((item) => trackDetails[item.track].category)))].sort();
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });

  let selectedCompany = null;
  let selectedPosition = null;
  let previousFocus = null;

  const renderCompanies = () => {
    companyGrid.innerHTML = companies.map((company) => `
      <button class="careers-reservation__company" type="button" data-company-id="${escapeHtml(company.id)}" aria-pressed="false">
        <img src="${escapeHtml(company.logo)}" alt="" />
        <strong>${escapeHtml(company.name)}</strong>
        <small>${escapeHtml(company.category)} · ${company.roles.length} proposed position profiles</small>
      </button>`).join('');
  };

  const updateProgress = (current) => {
    dialog.querySelectorAll('[data-progress-step]').forEach((step) => {
      if (step.dataset.progressStep === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  };

  const showStage = (stage) => {
    dialog.querySelectorAll('[data-reservation-stage]').forEach((section) => {
      section.hidden = section.dataset.reservationStage !== stage;
    });
    updateProgress(stage);
    dialog.querySelector('.careers-reservation__shell').scrollTop = 0;
  };

  const selectCompany = (company) => {
    selectedCompany = company;
    companyGrid.querySelectorAll('[data-company-id]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.companyId === company.id));
    });
    selectedCompanyView.innerHTML = `
      <img src="${escapeHtml(company.logo)}" alt="" />
      <div><strong>${escapeHtml(company.name)}</strong><span>${escapeHtml(company.category)}${company.id === 'parent' ? '' : ' · PROPOSED'}</span></div>`;
    categoryFilter.value = '';
    searchInput.value = '';
    renderPositions();
    showStage('position');
    dialog.querySelector('[data-reservation-back="company"]').focus();
  };

  const renderPositions = () => {
    if (!selectedCompany) return;
    const query = searchInput.value.trim().toLocaleLowerCase();
    const category = categoryFilter.value;
    const matchingRoles = selectedCompany.roles.filter((item) => {
      const matchesSearch = item.title.toLocaleLowerCase().includes(query)
        || item.overview.toLocaleLowerCase().includes(query);
      const matchesCategory = !category || trackDetails[item.track].category === category;
      return matchesSearch && matchesCategory;
    });
    positionList.innerHTML = matchingRoles.length
      ? matchingRoles.map((item, index) => `
        <button class="careers-reservation__position" type="button" data-position-index="${selectedCompany.roles.indexOf(item)}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(trackDetails[item.track].category)} · Potential future role</span>
        </button>`).join('')
      : '<p class="careers-reservation__empty">No potential positions match these filters.</p>';
  };

  const renderList = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

  const renderRequirements = (position) => {
    const details = trackDetails[position.track];
    requirementsView.innerHTML = `
      <div class="careers-requirements__identity">
        <p class="eyebrow">Proposed recruitment criteria · pending official approval</p>
        <h4>${escapeHtml(position.title)}</h4>
        <p><strong>Company:</strong> ${escapeHtml(selectedCompany.name)}</p>
        <p><strong>Category:</strong> ${escapeHtml(details.category)}</p>
        <span class="status-badge">FUTURE CONCEPT · NOT A VACANCY</span>
      </div>
      <div class="careers-requirements__grid">
        <article class="careers-requirements__item"><h5>Position overview</h5><p>${escapeHtml(position.overview)}</p></article>
        <article class="careers-requirements__item"><h5>Main responsibilities</h5>${renderList(position.responsibilities)}</article>
        <article class="careers-requirements__item"><h5>Eligibility and age</h5><p>Applicants would need to be at least 18 years old on the application date and meet approved role requirements. The prototype asks for an age-eligibility confirmation only; it does not collect a date of birth.</p></article>
        <article class="careers-requirements__item"><h5>Educational qualifications</h5><p>${escapeHtml(details.education)}</p></article>
        <article class="careers-requirements__item"><h5>Professional qualifications</h5><p>${escapeHtml(details.qualifications)}</p></article>
        <article class="careers-requirements__item"><h5>Relevant technical or professional skills</h5>${renderList(position.skills)}</article>
        <article class="careers-requirements__item"><h5>Experience expectations</h5><p>${escapeHtml(details.experience)}</p></article>
        <article class="careers-requirements__item"><h5>Leadership requirements</h5><p>${escapeHtml(details.leadership)}</p></article>
        <article class="careers-requirements__item"><h5>Communication and teamwork</h5><p>${escapeHtml(details.communication)}</p></article>
        <article class="careers-requirements__item"><h5>Additional role-specific considerations</h5><p>${escapeHtml(details.additional)}</p></article>
        <article class="careers-requirements__item"><h5>Potential supporting documents</h5>${renderList(supportingDocuments)}</article>
        <article class="careers-requirements__item"><h5>Potential selection and assessment stages</h5>${renderList(selectionStages)}</article>
        <article class="careers-requirements__item"><h5>Approval status</h5><p>These draft criteria are examples for planning and require company review and approval before any official vacancy is announced.</p></article>
      </div>`;
  };

  renderCompanies();

  openButton.addEventListener('click', () => {
    previousFocus = document.activeElement;
    dialog.showModal();
    companyGrid.querySelector('button')?.focus();
  });

  dialog.querySelector('[data-reservation-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    agreementInputs.forEach((input) => {
      input.checked = false;
      input.removeAttribute('aria-invalid');
    });
    agreementError.hidden = true;
    closedNotice.hidden = true;
    continueButton.disabled = false;
    continueButton.textContent = 'AGREE & CONTINUE';
    selectedCompany = null;
    selectedPosition = null;
    applicationForm.reset();
    applicationError.hidden = true;
    applicationSuccess.hidden = true;
    showStage('company');
    (previousFocus instanceof HTMLElement ? previousFocus : openButton).focus({ preventScroll: true });
  });

  companyGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-company-id]');
    const company = companies.find((item) => item.id === button?.dataset.companyId);
    if (company) selectCompany(company);
  });

  dialog.querySelector('[data-reservation-back="company"]').addEventListener('click', () => showStage('company'));
  dialog.querySelector('[data-reservation-back="position"]').addEventListener('click', () => showStage('position'));
  searchInput.addEventListener('input', renderPositions);
  categoryFilter.addEventListener('change', renderPositions);

  positionList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-position-index]');
    if (!button || !selectedCompany) return;
    const position = selectedCompany.roles[Number(button.dataset.positionIndex)];
    if (!position) return;
    selectedPosition = position;
    renderRequirements(position);
    agreementInputs.forEach((input) => {
      input.checked = false;
      input.removeAttribute('aria-invalid');
    });
    agreementError.hidden = true;
    closedNotice.hidden = true;
    continueButton.disabled = false;
    continueButton.textContent = 'AGREE & CONTINUE';
    showStage('requirements');
    dialog.querySelector('[data-reservation-back="position"]').focus();
  });

  continueButton.addEventListener('click', async () => {
    const missingAgreements = agreementInputs.filter((input) => !input.checked);
    if (missingAgreements.length) {
      missingAgreements.forEach((input) => input.setAttribute('aria-invalid', 'true'));
      agreementError.hidden = false;
      missingAgreements[0].focus();
      return;
    }

    agreementInputs.forEach((input) => input.removeAttribute('aria-invalid'));
    agreementError.hidden = true;
    continueButton.disabled = true;
    continueButton.textContent = 'CHECKING AVAILABILITY…';
    closedTitle.textContent = 'APPLICATIONS ARE NOT OPEN';
    closedMessage.textContent = 'The server-side date and official-approval gates must both be satisfied before applications can be submitted.';
    closedNotice.hidden = true;
    try {
      const response = await fetch('/api/careers/status', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('The Careers service is unavailable.');
      const status = await response.json();
      serviceStatus = status;
      dialog.querySelectorAll('[data-careers-retention]').forEach((element) => {
        element.textContent = `${status.retentionDays} days`;
      });
      if (status.enabled === true) {
        closedNotice.hidden = true;
        applicationError.hidden = true;
        applicationSuccess.hidden = true;
        showStage('application');
        dialog.querySelector('[name="fullName"]').focus();
        return;
      }

      const openingDate = new Intl.DateTimeFormat('en', {
        dateStyle: 'long',
        timeZone: 'Asia/Colombo'
      }).format(new Date(status.opensAt));
      closedMessage.textContent = status.localPrototype
        ? `Applications are disabled until ${openingDate} (Asia/Colombo) and until official recruitment approval is enabled on the local server. No application details were collected.`
        : `Applications are disabled until ${openingDate} (Asia/Colombo) and until official recruitment approval is enabled. No application details were collected.`;
      closedNotice.hidden = false;
      closedNotice.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (error) {
      closedTitle.textContent = 'CAREERS SERVICE UNAVAILABLE';
      closedMessage.textContent = `${error.message} No application details were collected.`;
      closedNotice.hidden = false;
      closedNotice.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } finally {
      continueButton.disabled = false;
      continueButton.textContent = 'CONTINUE';
    }
  });

  applicationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    applicationError.hidden = true;
    applicationSuccess.hidden = true;
    if (!selectedCompany || !selectedPosition) {
      applicationError.textContent = 'Select a company and position before applying.';
      applicationError.hidden = false;
      return;
    }

    const formData = new FormData(applicationForm);
    if (!applicationForm.reportValidity()) return;
    const files = formData.getAll('documents').filter((file) => file instanceof File && file.name);
    if (files.length > 3) {
      applicationError.textContent = 'Attach no more than 3 PDF documents.';
      applicationError.hidden = false;
      return;
    }
    const documents = [];
    const directUploads = serviceStatus?.directUploads === true;
    const batchId = directUploads ? crypto.randomUUID() : null;
    for (const file of files) {
      if (
        file.size > 10 * 1024 * 1024
        || !/\.pdf$/i.test(file.name)
        || (file.type && file.type !== 'application/pdf')
      ) {
        applicationError.textContent = 'Each supporting document must be a PDF no larger than 10 MB.';
        applicationError.hidden = false;
        return;
      }
      const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (new TextDecoder().decode(header) !== '%PDF-') {
        applicationError.textContent = 'Each supporting document must contain a valid PDF file.';
        applicationError.hidden = false;
        return;
      }
      if (directUploads) {
        documents.push({ file, id: crypto.randomUUID() });
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      documents.push({
        name: file.name,
        mimeType: 'application/pdf',
        contentBase64: btoa(binary)
      });
    }
    const payload = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      companyId: selectedCompany.id,
      positionTitle: selectedPosition.title,
      statement: formData.get('statement'),
      ageConfirmed: formData.get('ageConfirmed') === 'on',
      privacyConsent: formData.get('privacyConsent') === 'on',
      documents
    };
    submitButton.disabled = true;
    submitButton.textContent = directUploads && documents.length ? 'UPLOADING…' : 'SUBMITTING…';
    try {
      if (directUploads && documents.length) {
        if (typeof window.careersPrivateUpload !== 'function') {
          throw new Error('Secure document uploads are unavailable. Please try again later.');
        }
        for (const document of documents) {
          await window.careersPrivateUpload(document.file, batchId, document.id);
        }
        payload.documents = documents.map(({ id }) => ({ id }));
        submitButton.textContent = 'SUBMITTING…';
      }
      const response = await fetch('/api/careers/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The application could not be submitted.');
      applicationForm.reset();
      applicationSuccess.textContent = serviceStatus?.localPrototype
        ? `${result.message} Reference: ${result.id}. This local prototype stores the encrypted application and any PDFs only on this device and deletes them within 90 days. This position remains available for other applicants.`
        : `${result.message} Reference: ${result.id}. Application information and any PDFs are retained for up to ${serviceStatus?.retentionDays || 90} days. This position remains available for other applicants.`;
      applicationSuccess.hidden = false;
    } catch (error) {
      applicationError.textContent = error.message || 'The application could not be submitted.';
      applicationError.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'SUBMIT APPLICATION';
    }
  });
});
