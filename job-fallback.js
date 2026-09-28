// Robust fallback mapper for Teletalk job forms with variant field IDs/names.
(() => {
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const clean = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_\-./()]/g, '');
  const visible = (el) => el && el.offsetParent !== null;
  const candidates = (names) => names.flatMap(name => [
    document.getElementById(name),
    document.querySelector(`[name="${name}"]`),
    document.querySelector(`[id$="_${name}"]`),
    document.querySelector(`[id*="_${name}_"]`)
  ]).filter((el, i, arr) => el && arr.indexOf(el) === i);
  const emit = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  function setText(names, value) {
    if (value === undefined || value === null || value === '') return false;
    const el = candidates(names).find(visible) || candidates(names)[0];
    if (!el) return false;
    el.focus(); el.value = String(value); emit(el); return true;
  }
  function selectValue(names, value) {
    if (value === undefined || value === null || value === '') return false;
    const wanted = clean(value);
    const el = candidates(names).find(x => x.tagName === 'SELECT' && visible(x)) || candidates(names).find(x => x.tagName === 'SELECT');
    if (!el) return setText(names, value);
    const option = [...el.options].find(o => clean(o.value) === wanted || clean(o.textContent) === wanted || clean(o.textContent).includes(wanted) || wanted.includes(clean(o.textContent)));
    if (!option) return false;
    el.value = option.value; emit(el); return true;
  }
  async function selectValueWhenReady(names, value, timeout = 3500) {
    if (value === undefined || value === null || value === '') return false;
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (selectValue(names, value)) return true;
      await wait(120);
    }
    return false;
  }
  async function fillAddress(prefix, address) {
    if (!address) return;
    setText([`${prefix}_careof`, `${prefix}_care`], address.careOf);
    setText([`${prefix}_village`, `${prefix}_vill`], address.village);
    const districtOk = await selectValueWhenReady([`${prefix}_district`, `${prefix}district`], address.district);
    if (districtOk) await wait(450);
    await selectValueWhenReady([`${prefix}_upazila`, `${prefix}upazila`, `${prefix}_thana`], address.upazila);
    setText([`${prefix}_post`, `${prefix}_postoffice`], address.postOffice);
    setText([`${prefix}_postcode`, `${prefix}_pcode`], address.postCode);
    await wait(180);
  }
  function setDate(value) {
    if (!value) return false;
    const raw = String(value).trim();
    let day, month, year;
    let m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) [, year, month, day] = m;
    else { m = raw.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/); if (m) { [, day, m[2], year] = m; month = ({jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12})[m[2].slice(0,3).toLowerCase()]; } }
    if (!day || !month || !year) return setText(['dob', 'dateofbirth', 'date_of_birth'], raw);
    const okDay = selectValue(['dob_day', 'b_day', 'day', 'date_day'], day) || setText(['dob_day', 'b_day', 'day', 'date_day'], day);
    const okMonth = selectValue(['dob_month', 'b_month', 'month', 'date_month'], month) || selectValue(['dob_month', 'b_month', 'month', 'date_month'], String(month).padStart(2, '0'));
    const okYear = selectValue(['dob_year', 'b_year', 'year', 'date_year'], year) || setText(['dob_year', 'b_year', 'year', 'date_year'], year);
    return !!(okDay || okMonth || okYear);
  }
  function isoDate(value) {
    if (!value) return '';
    const raw = String(value).trim();
    let m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    return '';
  }
  function fieldNearLabel(labelPattern, occurrence, inputPattern = /^(text|number)$/i) {
    const labels = [...document.querySelectorAll('label')].filter(label => labelPattern.test(label.textContent.trim()));
    const label = labels[occurrence]; if (!label) return null;
    let node = label;
    for (let level = 0; level < 6 && node; level++, node = node.parentElement) {
      const fields = [...node.querySelectorAll('input:not([type="hidden"]), textarea, select')];
      const input = fields.find(el => el.matches('input') && inputPattern.test(el.type)) || fields.find(el => el.matches('input,textarea'));
      if (input) return input;
    }
    return null;
  }
  function fillLabeledField(labelPattern, occurrence, value, inputPattern = /^(text|number)$/i) {
    if (value === undefined || value === null || value === '') return false;
    const input = fieldNearLabel(labelPattern, occurrence, inputPattern); if (!input) return false;
    input.value = String(value); emit(input); return true;
  }
  function checkboxNearLabel(labelPattern, occurrence = 0) {
    const labels = [...document.querySelectorAll('label')].filter(x => labelPattern.test(x.textContent.trim()));
    const label = labels[occurrence];
    if (label?.htmlFor) { const linked = document.getElementById(label.htmlFor); if (linked?.type === 'checkbox') return linked; }
    let node = label;
    for (let level = 0; level < 8 && node; level++, node = node.parentElement) {
      const box = node.querySelector('input[type="checkbox"]'); if (box) return box;
    }
    const textNodes = [...document.querySelectorAll('body *')].filter(x => x.children.length === 0 && labelPattern.test(x.textContent.trim()));
    node = textNodes[occurrence];
    for (let level = 0; level < 6 && node; level++, node = node.parentElement) {
      const box = node.querySelector('input[type="checkbox"]'); if (box) return box;
    }
    return null;
  }
  function setCheckboxByLabel(labelPattern, occurrence, checked) {
    const box = checkboxNearLabel(labelPattern, occurrence); if (!box) return false;
    const wanted = Boolean(checked);
    if (box.checked !== wanted) box.click();
    return true;
  }
  function fillLabeledControl(labelPattern, occurrence, value, kind = 'any') {
    if (value === undefined || value === null || value === '') return false;
    const input = fieldNearLabel(labelPattern, occurrence, /^(text|number|date)$/i);
    const label = [...document.querySelectorAll('label')].filter(x => labelPattern.test(x.textContent.trim()))[occurrence];
    let node = label;
    for (let level = 0; level < 6 && node; level++, node = node.parentElement) {
      const controls = [...node.querySelectorAll('select, input:not([type=hidden]), textarea')];
      const control = kind === 'select' ? controls.find(x => x.tagName === 'SELECT') : (kind === 'input' ? controls.find(x => x.tagName === 'INPUT') : (input || controls[0]));
      if (control) {
        if (kind === 'checkbox' || control.type === 'checkbox') { control.checked = Boolean(value); emit(control); return true; }
        if (control.tagName === 'SELECT') return selectValue([control.id || control.name].filter(Boolean), value) || (control.value = String(value), emit(control), true);
        control.value = String(value); emit(control); return true;
      }
    }
    return false;
  }
  function setNativeValue(el, value) {
    let normalized = String(value ?? '').trim().replace(/,/g, '');
    if (el.type === 'number') {
      if (normalized === '' || !Number.isFinite(Number(normalized))) return false;
      const numeric = Number(normalized);
      if (el.min !== '' && numeric < Number(el.min)) return false;
      if (el.max !== '' && numeric > Number(el.max)) return false;
      normalized = String(numeric);
    }
    const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set;
    if (setter) setter.call(el, normalized); else el.value = normalized;
    emit(el); return true;
  }
  function sectionByHeading(text) {
    const heading = [...document.querySelectorAll('*')].find(el => el.children.length < 3 && el.textContent.trim().toLowerCase() === text.toLowerCase());
    if (!heading) return null;
    let node = heading.parentElement;
    for (let level = 0; level < 8 && node; level++, node = node.parentElement) {
      const nums = [...node.querySelectorAll('input[type="number"]')].filter(visible);
      if (nums.length >= 2 && nums.length <= 6) return node;
    }
    return null;
  }
  function fillNumericEducationBoxes(data) {
    const education = data?.education || [];
    const byIndex = new Map(education.map(item => [educationIndex(item), item]));
    for (const [heading, index] of [['SSC/Equivalent Level', 1], ['HSC/Equivalent Level', 2]]) {
      const item = byIndex.get(index); if (!item) continue;
      const section = sectionByHeading(heading); if (!section) continue;
      const inputs = [...section.querySelectorAll('input[type="number"]')].filter(visible);
      const values = [item.roll || item.rollNo || item.rollNumber || '', item.result || item.gpa || item.cgpa || ''];
      inputs.slice(0, 2).forEach((input, i) => { if (values[i] !== '') setNativeValue(input, values[i]); });
    }
  }
  function fillVisualFields(data) {
    const dob = isoDate(data?.basicInfo?.dateOfBirth);
    const dateInputs = [...document.querySelectorAll('input[type="date"]')].filter(visible);
    if (dob && dateInputs.length) { dateInputs[0].value = dob; emit(dateInputs[0]); }
    const education = data?.education || [];
    const rollValues = [], resultValues = [], examValues = [], subjectValues = [];
    for (const item of education) {
      const index = educationIndex(item);
      if (index) {
        rollValues[index - 1] = item.roll || item.rollNo || item.rollNumber;
        resultValues[index - 1] = item.result || item.gpa || item.cgpa;
        examValues[index - 1] = item.examination;
        subjectValues[index - 1] = item.group || item.subject;
      }
    }
    for (let i = 0; i < 4; i++) {
      fillLabeledField(/roll\s*no/i, i, rollValues[i], /^(text|number)$/i);
      fillLabeledField(/^result$/i, i, resultValues[i], /^(text|number)$/i);
      fillLabeledControl(/^examination$/i, i, examValues[i], 'select');
    }
    // Graduation section uses the label "Subject/Degree" rather than Group/Subject.
    fillLabeledControl(/subject\s*\/\s*degree/i, 0, subjectValues[2], 'select');
    fillLabeledControl(/group\s*\/\s*subject/i, 0, subjectValues[0], 'select');
    fillLabeledControl(/group\s*\/\s*subject/i, 1, subjectValues[1], 'select');
  }
  function educationIndex(item) {
    const exam = clean(item.examination);
    if (/ssc|dakhil|olevel|secondary/.test(exam)) return 1;
    if (/hsc|alim|alevel|higher|diploma/.test(exam)) return 2;
    if (/honors|honours|hons|bsc|ba|bcom|bss|bachelor|degree/.test(exam)) return 3;
    if (/master|mss|msc|ma|mcom|mba/.test(exam)) return 4;
    return 0;
  }
  function fillEducation(item) {
    const i = educationIndex(item); if (!i) return;
    selectValue([`exam${i}`, `education${i}`, `examination${i}`], item.examination);
    selectValue([`institute${i}`, `board${i}`, `board_${i}`], item.board);
    setText([`roll${i}`, `roll_no${i}`, `rollno${i}`, `roll_number${i}`], item.roll || item.rollNo || item.rollNumber);
    setText([`reg${i}`, `reg_no${i}`, `regno${i}`, `registration${i}`], item.reg || item.registration);
    const result = item.result || item.gpa || item.cgpa;
    if (result !== undefined && result !== '') {
      selectValue([`result${i}`, `result_gpa${i}`, `gpa${i}`, `result_type${i}`], result);
      setText([`result${i}`, `result_gpa${i}`, `gpa${i}`, `cgpa${i}`], result);
    }
    selectValue([`subject${i}`, `group${i}`, `degree_subject${i}`], item.group || item.subject);
    selectValue([`pyear${i}`, `p_year${i}`, `year${i}`, `passing_year${i}`], item.year);
    selectValue([`duration${i}`, `course_duration${i}`], item.duration);
  }
  async function robustFill(data) {
    const b = data?.basicInfo || {};
    setText(['name', 'applicantname'], b.applicantName);
    setText(['name_bn', 'applicantnamebn', 'applicantnamebangla'], b.applicantNameBangla);
    setText(['father', 'fathername'], b.fatherName); setText(['father_bn', 'fathernamebn', 'fathernamebangla'], b.fatherNameBangla);
    setText(['mother', 'mothername'], b.motherName); setText(['mother_bn', 'mothernamebn', 'mothernamebangla'], b.motherNameBangla);
    setDate(b.dateOfBirth);
    setText(['nid_no', 'nidno', 'nationalid', 'national_id'], b.nationalId);
    setText(['mobile', 'mobile_no', 'phone', 'phone_no'], b.mobileNumber);
    setText(['confirm_mobile', 'confirm_mobile_no', 'cmobile_no', 're_mobile'], b.mobileNumber);
    setText(['email', 'emailaddress', 'email_address', 'email_id'], b.email);
    selectValue(['religion', 'religion_id'], b.religion); selectValue(['gender', 'sex'], b.gender); selectValue(['marital_status', 'maritalstatus'], b.maritalStatus);
    const departmentalStatus = b.departmentalStatus || 'Not Applicable';
    selectValue(['dep_status', 'departmental_status', 'departmentalstatus'], departmentalStatus) || fillLabeledControl(/departmental\s*status/i, 0, departmentalStatus, 'select');
    // Present address must be completed first because Upazila options are loaded from District.
    await fillAddress('present', data?.presentAddress);
    // When Same as Present Address is selected, do not touch permanent cascading fields first.
    if (data?.sameAsPresentAddress && data?.presentAddress?.district && data?.presentAddress?.upazila) {
      await wait(500);
      setCheckboxByLabel(/same\s+as\s+present\s+address/i, 0, true);
    } else {
      await fillAddress('permanent', data?.permanentAddress);
    }
    for (const item of (data?.education || [])) { fillEducation(item); await wait(120); }
    fillVisualFields(data);
    fillNumericEducationBoxes(data);
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'FILL_JOB_APP') robustFill(message.data).catch(console.error);
  });
})();
