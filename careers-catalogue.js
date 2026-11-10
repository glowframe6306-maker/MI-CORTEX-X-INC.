'use strict';

(function installCareersCatalogue(global) {
  const excludedTitles = ['CEO', 'OWNER', 'CHAIRMAN', 'FOUNDER'];
  const groups = {
    executive: [
      ['Chief Operating Officer (COO)', 'executive'],
      ['Chief Technology Officer (CTO)', 'executive'],
      ['Chief Financial Officer (CFO)', 'executive'],
      ['Chief Information Officer (CIO)', 'executive'],
      ['Chief Marketing Officer (CMO)', 'executive'],
      ['Chief Human Resources Officer (CHRO)', 'executive'],
      ['Chief Product Officer (CPO)', 'executive'],
      ['Chief Strategy Officer (CSO)', 'executive'],
      ['Chief Security Officer (CSO / Security)', 'executive'],
      ['Chief Innovation Officer', 'executive'],
      ['Chief Research Officer', 'executive'],
      ['Chief Data Officer', 'executive'],
      ['Chief Digital Officer', 'executive'],
      ['Chief Compliance Officer', 'executive'],
      ['Chief Legal Officer', 'executive'],
      ['President (Executive)', 'executive'],
      ['Executive Director', 'director'],
      ['Managing Director', 'director'],
      ['Operations Director', 'director'],
      ['Technical Director', 'director'],
      ['Engineering Director', 'director'],
      ['Research Director', 'director'],
      ['Finance Director', 'director'],
      ['Marketing Director', 'director'],
      ['Human Resources Director', 'director'],
      ['Product Director', 'director'],
      ['Department Director', 'director'],
      ['Regional Director', 'director'],
      ['Security Director', 'director'],
      ['Innovation Director', 'director'],
      ['Data Science Director', 'director'],
      ['Software Engineering Director', 'director'],
      ['Senior Vice President', 'executive'],
      ['Vice President', 'executive'],
      ['Assistant Vice President', 'executive'],
      ['Executive', 'executive'],
      ['Senior Executive', 'executive'],
      ['Department Executive', 'executive'],
      ['Technical Executive', 'executive']
    ],
    management: [
      ['General Manager', 'manager'],
      ['Deputy General Manager', 'manager'],
      ['Assistant General Manager', 'manager'],
      ['Senior Manager', 'manager'],
      ['Manager', 'manager'],
      ['Operations Manager', 'manager'],
      ['Project Manager', 'manager'],
      ['Engineering Manager', 'manager'],
      ['IT Manager', 'manager'],
      ['Software Development Manager', 'manager'],
      ['Product Manager', 'manager'],
      ['Research Manager', 'manager'],
      ['Human Resources Manager', 'manager'],
      ['Finance Manager', 'manager'],
      ['Marketing Manager', 'manager'],
      ['Sales Manager', 'manager'],
      ['Customer Relations Manager', 'manager'],
      ['Quality Assurance Manager', 'manager'],
      ['Administration Manager', 'manager'],
      ['Department Manager', 'manager'],
      ['Security Manager', 'manager'],
      ['Data and Analytics Manager', 'manager'],
      ['Design Manager', 'manager'],
      ['Procurement Manager', 'manager'],
      ['Training and Development Manager', 'manager'],
      ['Compliance Manager', 'manager'],
    ],
    supervision: [
      ['General Supervisor', 'supervisor'],
      ['Senior Supervisor', 'supervisor'],
      ['Supervisor', 'supervisor'],
      ['Assistant Supervisor', 'supervisor'],
      ['Team Leader', 'supervisor'],
      ['Team Manager', 'supervisor'],
      ['Project Leader', 'supervisor'],
      ['Technical Supervisor', 'supervisor'],
      ['Operations Supervisor', 'supervisor'],
      ['Quality Control Supervisor', 'supervisor'],
      ['Project Supervisor', 'supervisor'],
      ['Department Supervisor', 'supervisor'],
      ['Quality Assurance Supervisor', 'supervisor'],
      ['Service Supervisor', 'supervisor'],
      ['Field Operations Supervisor', 'supervisor']
    ],
    corporateProfessionals: [
      ['Software Engineer', 'software'],
      ['Senior Software Engineer', 'software'],
      ['Software Developer', 'software'],
      ['Business Analyst', 'analyst'],
      ['Data Analyst', 'analyst'],
      ['Financial Analyst', 'analyst'],
      ['Researcher', 'researcher'],
      ['Research Scientist', 'researcher'],
      ['Product Designer', 'designer'],
      ['UI/UX Designer', 'designer'],
      ['Graphic Designer', 'designer'],
      ['HR Specialist', 'specialist'],
      ['Marketing Specialist', 'specialist'],
      ['Technical Specialist', 'specialist'],
      ['Quality Assurance Engineer', 'quality'],
      ['Systems Engineer', 'engineering'],
      ['Cloud Engineer', 'engineering'],
      ['Cybersecurity Analyst', 'analyst'],
      ['Network Engineer', 'engineering'],
      ['Technical Officer', 'support'],
      ['IT Support Officer', 'support'],
      ['Customer Support Representative', 'support'],
      ['Customer Service Officer', 'support'],
      ['Project Analyst', 'analyst'],
      ['Digital Transformation Specialist', 'specialist'],
      ['Data Governance Specialist', 'specialist'],
      ['Technical Writer', 'specialist']
    ],
    professionals: [
      ['Software Engineer', 'software'],
      ['Senior Software Engineer', 'software'],
      ['Software Developer', 'software'],
      ['Developer', 'software'],
      ['Web Developer', 'software'],
      ['Frontend Developer', 'software'],
      ['Backend Developer', 'software'],
      ['Full-Stack Developer', 'software'],
      ['Mobile Application Developer', 'software'],
      ['Backend and API Developer', 'software'],
      ['Aviation Software Developer', 'software'],
      ['Automotive Software Developer', 'software'],
      ['AI Application Developer', 'software'],
      ['Workflow Automation Developer', 'software'],
      ['Learning Platform Developer', 'software'],
      ['Digital Content Developer', 'software'],
      ['Robot Programmer', 'software'],
      ['Embedded Systems Developer', 'software'],
      ['Cloud Software Developer', 'software'],
      ['AI Engineer', 'engineering'],
      ['Machine Learning Engineer', 'engineering'],
      ['Data Scientist', 'analyst'],
      ['Data Analyst', 'analyst'],
      ['Cybersecurity Analyst', 'analyst'],
      ['Security Engineer', 'engineering'],
      ['Network Engineer', 'engineering'],
      ['Cloud Engineer', 'engineering'],
      ['Systems Engineer', 'engineering'],
      ['Hardware Engineer', 'engineering'],
      ['Hardware Researcher', 'researcher'],
      ['Electrical Engineer', 'engineering'],
      ['Electronics Engineer', 'engineering'],
      ['Aerospace Engineer', 'engineering'],
      ['Automotive Engineer', 'engineering'],
      ['Robotics Engineer', 'engineering'],
      ['Research Scientist', 'researcher'],
      ['Researcher', 'researcher'],
      ['AI Research Scientist', 'researcher'],
      ['Cybersecurity Researcher', 'researcher'],
      ['Aerodynamics Researcher', 'researcher'],
      ['Education Researcher', 'researcher'],
      ['Product Research Analyst', 'analyst'],
      ['Research and Development Researcher', 'researcher'],
      ['Research Assistant', 'entry'],
      ['Research Assistants', 'entry'],
      ['UI/UX Designer', 'designer'],
      ['Graphic Designer', 'designer'],
      ['Product Designer', 'designer'],
      ['Designer', 'designer'],
      ['Business Analyst', 'analyst'],
      ['Financial Analyst', 'analyst'],
      ['Flight Data Analyst', 'analyst'],
      ['Mobility Data Analyst', 'analyst'],
      ['AI Model Evaluation Specialist', 'specialist'],
      ['HR Specialist', 'specialist'],
      ['Marketing Specialist', 'specialist'],
      ['Technical Specialist', 'specialist'],
      ['Security Software Developer', 'software'],
      ['Information Security Analyst', 'analyst'],
      ['Network Security Engineer', 'engineering'],
      ['Quality Assurance Engineer', 'quality'],
      ['Software Tester', 'quality'],
      ['Software Quality Analyst', 'quality'],
      ['Quality Control Analyst', 'quality'],
      ['Technician', 'technician'],
      ['Technical Officer', 'support'],
      ['Technical Support Officer', 'support'],
      ['IT Support Officer', 'support'],
      ['Customer Support Representative', 'support'],
      ['Customer Service Officer', 'support'],
      ['Engineering Technical Support Officer', 'support'],
      ['Fleet Technology Support Officer', 'support'],
      ['Education Systems Support Officer', 'support'],
      ['Integration Support Officer', 'support'],
      ['Electronics Test Analyst', 'quality'],
      ['PCB Design Technician', 'technician'],
      ['Hardware Diagnostics Technician', 'technician'],
      ['Robot Systems Test Technician', 'technician'],
      ['Device Compatibility Analyst', 'analyst'],
      ['Systems Architect', 'engineering'],
      ['Aerospace Systems Engineer', 'engineering'],
      ['Automotive Systems Engineer', 'engineering'],
      ['Digital Solutions Engineer', 'engineering'],
      ['Electrical Engineer', 'engineering'],
      ['Electronics Design Engineer', 'engineering'],
      ['Embedded Robotics Engineer', 'engineering'],
      ['Sensor Systems Researcher', 'researcher'],
      ['Flight Systems Analyst', 'analyst'],
      ['Vehicle Diagnostics Specialist', 'specialist'],
      ['Learning Experience Designer', 'designer'],
      ['Digital Education Content Specialist', 'specialist'],
      ['Education Content Designer', 'designer'],
      ['Security Awareness Coordinator', 'support'],
      ['Information Security Specialist', 'specialist'],
      ['Systems Security Engineer', 'engineering'],
      ['Integration Engineer', 'engineering'],
      ['Cloud Systems Specialist', 'specialist'],
      ['Digital Solutions Specialist', 'specialist'],
      ['Automation Engineer', 'engineering'],
      ['Sensor Systems Engineer', 'engineering'],
      ['Robotics Systems Engineer', 'engineering'],
      ['Prototype Development Engineer', 'engineering'],
      ['PCB Design Engineer', 'engineering'],
      ['Electronics Test Engineer', 'quality'],
      ['Flight Data Engineer', 'engineering'],
      ['Aerospace Research Scientist', 'researcher'],
      ['Automotive Researcher', 'researcher'],
      ['Electronics Researcher', 'researcher'],
      ['Robotics Researcher', 'researcher'],
      ['Digital Transformation Specialist', 'specialist'],
      ['Workflow Automation Specialist', 'specialist'],
      ['Data Governance Specialist', 'specialist'],
      ['Product Researcher', 'researcher'],
      ['Project Analyst', 'analyst'],
      ['Operations Analyst', 'analyst'],
      ['Data Entry Operator', 'support'],
      ['Digital Product Designer', 'designer'],
      ['Creative Professional', 'designer'],
      ['Creative Professionals', 'designer'],
      ['Digital Content Professional', 'specialist'],
      ['Digital Content Professionals', 'specialist'],
      ['Administrator', 'support'],
      ['Specialist', 'specialist'],
      ['Analyst', 'analyst'],
      ['Engineer', 'engineering'],
      ['Senior Systems Engineer', 'engineering'],
      ['Technical Support Specialist', 'support'],
      ['Technical Writer', 'specialist'],
      ['Documentation Officer', 'support']
    ],
    administration: [
      ['Administrator', 'support'],
      ['Senior Administrator', 'support'],
      ['Assistant Administrator', 'support'],
      ['Administrative Officer', 'support'],
      ['Administrative Staff', 'support'],
      ['HR Officer', 'support'],
      ['Finance Officer', 'support'],
      ['Accounts Officer', 'support'],
      ['Operations Officer', 'support'],
      ['Project Officer', 'support'],
      ['Documentation Officer', 'support'],
      ['Office Assistant', 'entry'],
      ['Data Entry Operator', 'support'],
      ['Receptionist', 'support'],
      ['Coordinator', 'support'],
      ['Assistant Coordinator', 'support'],
      ['Operations and Administration Coordinator', 'support'],
      ['Project Coordinator', 'support'],
      ['Research Coordinator', 'support'],
      ['Human Resources Coordinator', 'support'],
      ['Finance and Accounts Assistant', 'entry'],
      ['Administrative Assistant', 'entry'],
      ['Customer Support Representative', 'support'],
      ['Customer Service Officer', 'support'],
      ['IT Support Officer', 'support'],
      ['Technical Support Officer', 'support'],
      ['Legal and Compliance Officer', 'support'],
      ['Procurement Officer', 'support'],
      ['Marketing Coordinator', 'support']
    ],
    entry: [
      ['Junior Software Developer', 'entry'],
      ['Junior Web Developer', 'entry'],
      ['Junior Data Analyst', 'entry'],
      ['Junior Engineer', 'entry'],
      ['Junior Researcher', 'entry'],
      ['Associate Software Engineer', 'entry'],
      ['Associate Data Analyst', 'entry'],
      ['Associate Researcher', 'entry'],
      ['Engineering Assistant', 'entry'],
      ['Technical Assistant', 'entry'],
      ['Project Assistant', 'entry'],
      ['Project Assistants', 'entry'],
      ['Operations Assistant', 'entry'],
      ['Operations Assistants', 'entry'],
      ['Research Assistant', 'entry'],
      ['Research Assistants', 'entry'],
      ['Administrative Assistant', 'entry'],
      ['Graduate Engineer', 'entry'],
      ['Graduate Software Developer', 'entry'],
      ['Graduate Researcher', 'entry'],
      ['Graduate Trainee', 'entry'],
      ['Engineering Intern', 'entry'],
      ['Software Development Intern', 'entry'],
      ['Research Intern', 'entry'],
      ['Data Analyst Intern', 'entry'],
      ['Technical Trainee', 'entry'],
      ['Management Trainee', 'entry'],
      ['Customer Support Trainee', 'entry'],
      ['Entry-Level Technician', 'entry'],
      ['Creative Professional', 'designer'],
      ['Creative Professionals', 'designer'],
      ['Digital Content Professional', 'specialist'],
      ['Digital Content Professionals', 'specialist']
    ]
  };

  const legacyPositions = {
    parent: ['Chief Technology Officer', 'Research and Technology Director', 'Software Engineer', 'Digital Product Manager', 'Operations and Administration Coordinator'],
    aerotech: ['Aerospace Systems Engineer', 'Aviation Software Developer', 'Flight Data Analyst', 'Aerodynamics Researcher', 'Engineering Technical Support Officer'],
    aitech: ['Machine Learning Engineer', 'AI Application Developer', 'AI Research Scientist', 'Data Scientist', 'AI Model Evaluation Specialist'],
    autotech: ['Automotive Systems Engineer', 'Automotive Software Developer', 'Vehicle Diagnostics Specialist', 'Mobility Data Analyst', 'Fleet Technology Support Officer'],
    codex: ['Software Engineer', 'Frontend Developer', 'Backend and API Developer', 'Software Quality Analyst', 'UI/UX Designer'],
    cybertech: ['Cybersecurity Researcher', 'Information Security Analyst', 'Network Security Engineer', 'Security Software Developer', 'Security Awareness Coordinator'],
    digitech: ['Digital Solutions Engineer', 'Cloud Systems Specialist', 'Workflow Automation Developer', 'Digital Product Manager', 'Integration Support Officer'],
    edutech: ['Learning Platform Developer', 'Learning Experience Designer', 'Education Researcher', 'Digital Education Content Specialist', 'Education Systems Support Officer'],
    electrotech: ['Electrical Engineer', 'Electronics Design Engineer', 'Embedded Systems Developer', 'PCB Design Technician', 'Electronics Test Analyst'],
    hardtech: ['Computer Hardware Engineer', 'Systems Architect', 'Hardware Diagnostics Technician', 'Device Compatibility Analyst', 'Hardware Researcher'],
    innovation: ['Research and Development Researcher', 'Prototype Development Engineer', 'Innovation Project Manager', 'Product Research Analyst', 'Research Documentation Specialist'],
    robotech: ['Robotics Engineer', 'Robot Programmer', 'Automation Engineer', 'Sensor Systems Researcher', 'Robot Systems Test Technician']
  };

  const companyConfig = [
    { id: 'parent', name: 'MI CORTEX X INC.', groups: ['executive', 'management', 'supervision', 'corporateProfessionals', 'administration', 'entry'] },
    { id: 'aerotech', name: 'MI CORTEX AEROTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Aerospace Engineer', 'Aerospace Systems Engineer', 'Aerospace Research Scientist', 'Flight Data Analyst', 'Flight Data Engineer', 'Aerodynamics Researcher', 'Aviation Software Developer', 'Systems Engineer', 'Electrical Engineer', 'Quality Assurance Engineer', 'Technical Writer'] },
    { id: 'aitech', name: 'MI CORTEX AITECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['AI Engineer', 'Machine Learning Engineer', 'AI Application Developer', 'AI Research Scientist', 'Data Scientist', 'Data Analyst', 'AI Model Evaluation Specialist', 'Data Governance Specialist', 'Research Scientist', 'Software Engineer', 'Cloud Engineer', 'Business Analyst', 'Quality Assurance Engineer'] },
    { id: 'autotech', name: 'MI CORTEX AUTOTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Automotive Engineer', 'Automotive Systems Engineer', 'Automotive Software Developer', 'Automotive Researcher', 'Vehicle Diagnostics Specialist', 'Mobility Data Analyst', 'Fleet Technology Support Officer', 'Fleet Manager', 'Mechanical Engineer', 'Electrical Engineer', 'Embedded Systems Developer', 'Quality Assurance Engineer', 'Systems Engineer'] },
    { id: 'codex', name: 'MI CORTEX CODEX', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Software Engineer', 'Senior Software Engineer', 'Software Developer', 'Web Developer', 'Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'Mobile Application Developer', 'Backend and API Developer', 'Software Quality Analyst', 'Software Tester', 'UI/UX Designer', 'Product Designer', 'Cloud Engineer', 'Systems Engineer', 'Technical Writer'] },
    { id: 'cybertech', name: 'MI CORTEX CYBERTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Chief Security Officer (CSO / Security)', 'Chief Information Security Officer', 'Security Director', 'Cybersecurity Analyst', 'Cybersecurity Researcher', 'Information Security Analyst', 'Network Security Engineer', 'Security Engineer', 'Systems Security Engineer', 'Security Software Developer', 'Security Awareness Coordinator', 'Information Security Specialist', 'Security Manager', 'Compliance Manager', 'Network Engineer', 'Incident Response Analyst', 'Penetration Testing Specialist', 'Digital Forensics Analyst'] },
    { id: 'digitech', name: 'MI CORTEX DIGITECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Digital Solutions Engineer', 'Digital Solutions Specialist', 'Digital Product Designer', 'Digital Product Manager', 'Cloud Systems Specialist', 'Cloud Engineer', 'Workflow Automation Developer', 'Workflow Automation Specialist', 'Integration Support Officer', 'Integration Engineer', 'Digital Transformation Specialist', 'Data Analyst', 'Business Analyst', 'Software Engineer', 'Technical Writer'] },
    { id: 'edutech', name: 'MI CORTEX EDUTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Learning Platform Developer', 'Learning Experience Designer', 'Education Researcher', 'Education Director', 'Education Systems Support Officer', 'Digital Education Content Specialist', 'Education Content Designer', 'Instructional Designer', 'Educational Technologist', 'Assessment Systems Specialist', 'Software Engineer', 'Data Analyst', 'Quality Assurance Engineer', 'Technical Writer'] },
    { id: 'electrotech', name: 'MI CORTEX ELECTROTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Electrical Engineer', 'Electronics Engineer', 'Electronics Design Engineer', 'Embedded Systems Developer', 'PCB Design Technician', 'PCB Design Engineer', 'Electronics Test Analyst', 'Electronics Test Engineer', 'Electronics Researcher', 'Embedded Systems Engineer', 'Hardware Engineer', 'Quality Assurance Engineer', 'Systems Engineer', 'Technician'] },
    { id: 'hardtech', name: 'MI CORTEX HARDTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Computer Hardware Engineer', 'Hardware Engineer', 'Systems Architect', 'Hardware Diagnostics Technician', 'Device Compatibility Analyst', 'Hardware Researcher', 'Systems Engineer', 'Network Engineer', 'Cloud Engineer', 'Quality Assurance Engineer', 'Technical Support Specialist', 'Computer Systems Technician'] },
    { id: 'innovation', name: 'MI CORTEX INNOVATION', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Chief Innovation Officer', 'Chief Research Officer', 'Innovation Director', 'Research Director', 'Research Scientist', 'Researcher', 'Research and Development Researcher', 'Prototype Development Engineer', 'Innovation Project Manager', 'Product Research Analyst', 'Product Researcher', 'Research Documentation Specialist', 'Research Assistant', 'Project Analyst', 'Data Analyst', 'Technical Writer', 'Systems Engineer'] },
    { id: 'robotech', name: 'MI CORTEX ROBOTECH', groups: ['executive', 'management', 'supervision', 'administration', 'entry'], professional: ['Robotics Engineer', 'Robotics Systems Engineer', 'Robot Programmer', 'Automation Engineer', 'Sensor Systems Researcher', 'Sensor Systems Engineer', 'Robot Systems Test Technician', 'Embedded Robotics Engineer', 'Electrical Engineer', 'Electronics Engineer', 'Systems Engineer', 'Quality Assurance Engineer', 'Technician'] }
  ];

  const roleCategory = (track) => ({
    executive: 'C-Level and Executive Leadership',
    director: 'Directors and Senior Leadership',
    manager: 'Managers',
    supervisor: 'Supervisors and Team Leaders',
    software: 'Software Developers and Digital Professionals',
    engineering: 'Engineers and Technical Professionals',
    researcher: 'Researchers and Scientists',
    analyst: 'Analysts and Specialists',
    designer: 'Designers and Creative Professionals',
    specialist: 'Specialists',
    quality: 'Quality Assurance and Testing',
    technician: 'Technicians and Technical Support',
    support: 'Administrative, Technical and Support Professionals',
    entry: 'Entry-Level and Early-Career Roles'
  }[track] || 'Professional and Technical Employees');

  const companyCategories = {
    parent: 'Cross-company corporate leadership and shared services',
    aerotech: 'Aerospace engineering and aviation research',
    aitech: 'Artificial intelligence, machine learning and data science',
    autotech: 'Automotive engineering, diagnostics and intelligent mobility',
    codex: 'Software engineering and developer tools',
    cybertech: 'Cybersecurity, information assurance and network security',
    digitech: 'Digital solutions, cloud and workflow automation',
    edutech: 'Education technology, digital learning and assessment',
    electrotech: 'Electrical engineering, electronics and embedded systems',
    hardtech: 'Computer hardware, systems and device diagnostics',
    innovation: 'Research, experimentation and technology prototyping',
    robotech: 'Robotics, automation, sensors and intelligent machines'
  };
  const companyStructure = {
    parent: [
      ['Digital Transformation Director', 'director'],
      ['Data Science Director', 'director'],
      ['Software Engineering Director', 'director']
    ],
    aerotech: [
      ['Aerospace Engineering Director', 'director'],
      ['Laboratory Manager', 'manager'],
      ['Laboratory Supervisor', 'supervisor'],
      ['Shift Supervisor', 'supervisor']
    ],
    aitech: [
      ['Data Science Director', 'director'],
      ['Software Engineering Director', 'director'],
      ['Laboratory Manager', 'manager'],
      ['Laboratory Supervisor', 'supervisor']
    ],
    autotech: [
      ['Automotive Engineering Director', 'director'],
      ['Fleet Manager', 'manager'],
      ['Shift Supervisor', 'supervisor'],
      ['Production Supervisor', 'supervisor']
    ],
    codex: [
      ['Software Engineering Director', 'director'],
      ['Digital Transformation Director', 'director']
    ],
    cybertech: [
      ['Security Director', 'director'],
      ['Software Engineering Director', 'director'],
      ['Shift Supervisor', 'supervisor']
    ],
    digitech: [
      ['Digital Transformation Director', 'director'],
      ['Software Engineering Director', 'director'],
      ['Data Science Director', 'director']
    ],
    edutech: [
      ['Education Director', 'director'],
      ['Digital Transformation Director', 'director']
    ],
    electrotech: [
      ['Electronics Engineering Director', 'director'],
      ['Laboratory Manager', 'manager'],
      ['Laboratory Supervisor', 'supervisor'],
      ['Shift Supervisor', 'supervisor'],
      ['Production Supervisor', 'supervisor']
    ],
    hardtech: [
      ['Software Engineering Director', 'director'],
      ['Laboratory Manager', 'manager'],
      ['Laboratory Supervisor', 'supervisor'],
      ['Shift Supervisor', 'supervisor'],
      ['Production Supervisor', 'supervisor']
    ],
    innovation: [
      ['Innovation Director', 'director'],
      ['Research Director', 'director'],
      ['Data Science Director', 'director'],
      ['Laboratory Manager', 'manager'],
      ['Laboratory Supervisor', 'supervisor']
    ],
    robotech: [
      ['Robotics Director', 'director'],
      ['Software Engineering Director', 'director'],
      ['Laboratory Manager', 'manager'],
      ['Laboratory Supervisor', 'supervisor'],
      ['Shift Supervisor', 'supervisor'],
      ['Production Supervisor', 'supervisor']
    ]
  };
  const inferTrack = (title) => {
    if (/director/i.test(title)) return 'director';
    if (/chief|president|vice president|executive/i.test(title)) return 'executive';
    if (/manager/i.test(title)) return 'manager';
    if (/supervisor|team leader|team manager|project leader/i.test(title)) return 'supervisor';
    if (/technician/i.test(title)) return 'technician';
    if (/researcher|scientist/i.test(title)) return 'researcher';
    if (/analyst/i.test(title)) return 'analyst';
    if (/designer|creative/i.test(title)) return 'designer';
    if (/developer|programmer|software|web/i.test(title)) return 'software';
    if (/engineer|architect/i.test(title)) return 'engineering';
    if (/quality|tester/i.test(title)) return 'quality';
    if (/assistant|trainee|intern|graduate|entry-level/i.test(title)) return 'entry';
    if (/officer|coordinator|administrator|representative/i.test(title)) return 'support';
    return 'specialist';
  };
  const companies = companyConfig.map((company) => {
    const positions = new Map();
    const addPosition = (title, track) => {
      const key = title.trim().toLocaleUpperCase('en');
      if (excludedTitles.includes(key)) return;
      if (!positions.has(key)) positions.set(key, { title, track, category: roleCategory(track) });
    };
    company.groups.forEach((groupName) => {
      groups[groupName].forEach(([title, track]) => addPosition(title, track));
    });
    (company.professional || []).forEach((title) => {
      const entry = Object.values(groups).flat().find(([existing]) => existing === title);
      addPosition(title, entry?.[1] || inferTrack(title));
    });
    (legacyPositions[company.id] || []).forEach((title) => {
      const entry = Object.values(groups).flat().find(([existing]) => existing === title);
      addPosition(title, entry?.[1] || inferTrack(title));
    });
    (companyStructure[company.id] || []).forEach(([title, track]) => addPosition(title, track));
    return {
      id: company.id,
      name: company.name,
      category: companyCategories[company.id],
      positions: [...positions.values()]
    };
  });

  const catalogue = { excludedTitles, companies };
  if (typeof module !== 'undefined' && module.exports) module.exports = catalogue;
  else global.CAREERS_CATALOGUE = catalogue;
})(globalThis);
