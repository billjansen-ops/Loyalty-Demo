// molecule-test-modal.js - Reusable modal component for molecule testing

const MoleculeTestModal = {
  
  // Open the modal
  open: function(moleculeKey = null) {
    // Create modal HTML
    const modalHTML = `
      <div id="moleculeTestModal" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        ">
          <!-- LONGORIA: Sticky Header -->
          <div style="
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 18px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 8px;">
                  🧪 Test Molecule Functions
                </div>
                ${moleculeKey ? `
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                    <span style="font-size: 12px; color: #6b7280;">Testing:</span>
                    <span style="
                      font-size: 13px;
                      font-weight: 600;
                      color: #0066cc;
                      background: #e0f2fe;
                      padding: 3px 8px;
                      border-radius: 4px;
                      font-family: 'Monaco', 'Courier New', monospace;
                    ">${moleculeKey}</span>
                  </div>
                ` : ''}
              </div>
              <button onclick="MoleculeTestModal.close()" style="
                padding: 4px 12px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                color: #374151;
                cursor: pointer;
              ">✕ Close</button>
            </div>
          </div>

          <!-- LONGORIA: Scrollable Content -->
          <div style="
            flex: 1;
            overflow-y: auto;
            padding: 12px 16px;
          ">
            
            <!-- Section 1: encodeMolecule -->
            <div style="
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px;
              margin-bottom: 10px;
            ">
              <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #111827;">
                1. encodeMolecule(textValue) → v_ref_id
              </h3>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                Converts text value to database reference ID
              </div>

              <div style="margin-bottom: 8px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                    Text Value
                  </label>
                  <input type="text" id="encode_textValue" placeholder="e.g., Delta Air Lines" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                  ">
                </div>
              </div>

              <button type="button" onclick="MoleculeTestModal.testEncode()" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                background: #0066cc;
                color: white;
              ">🧪 Test Encode</button>

              <div id="encodeResult" style="display: none; margin-top: 8px;"></div>
            </div>

            <!-- Section 2: decodeMolecule -->
            <div style="
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px;
              margin-bottom: 10px;
            ">
              <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #111827;">
                2. decodeMolecule(v_ref_id) → textValue
              </h3>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                Converts database reference ID to text value
              </div>

              <div style="margin-bottom: 8px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                    v_ref_id
                  </label>
                  <input type="number" id="decode_v_ref_id" placeholder="e.g., 42" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                  ">
                </div>
              </div>

              <button type="button" onclick="MoleculeTestModal.testDecode()" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                background: #0066cc;
                color: white;
              ">🧪 Test Decode</button>

              <div id="decodeResult" style="display: none; margin-top: 8px;"></div>
            </div>

            <!-- Section 3: getMolecule -->
            <div style="
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px;
              margin-bottom: 10px;
            ">
              <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #111827;">
                3. getMolecule() → config/properties
              </h3>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                Gets full molecule configuration and display properties
              </div>

              <button type="button" onclick="MoleculeTestModal.testGetMolecule()" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                background: #0066cc;
                color: white;
              ">🧪 Test Get</button>

              <div id="getResult" style="display: none; margin-top: 8px;"></div>
            </div>

            <!-- Section 4: getMoleculeValue (with context & date) -->
            <div style="
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px;
            ">
              <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #111827;">
                4. getMoleculeValue(context, date) → resolved value
              </h3>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                Evaluates molecule with context (member_id) and optional date parameter
              </div>

              <div style="margin-bottom: 8px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                    Member ID
                  </label>
                  <input type="text" id="eval_member_id" placeholder="e.g., 2153442807" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                  ">
                </div>
              </div>

              <div style="margin-bottom: 8px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                    Date (optional)
                    <span style="font-size: 11px; color: #6b7280; font-weight: 400;">— for temporal molecules like member_tier_on_date</span>
                  </label>
                  <input type="date" id="eval_date" placeholder="2025-06-15" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                  ">
                </div>
              </div>

              <button type="button" onclick="MoleculeTestModal.testEvaluate()" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                background: #0066cc;
                color: white;
              ">🧪 Test Evaluate</button>

              <div id="evaluateResult" style="display: none; margin-top: 8px;"></div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Store moleculeKey for test functions to use
    this.moleculeKey = moleculeKey;
  },

  // Test encodeMolecule
  testEncode: async function() {
    const API_BASE = 'http://localhost:4001';
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    const resultBox = document.getElementById('encodeResult');
    
    const moleculeKey = this.moleculeKey;
    const textValue = document.getElementById('encode_textValue').value.trim();

    if (!moleculeKey) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ No molecule selected. Please open test from a specific molecule.
        </div>
      `;
      resultBox.style.display = 'block';
      return;
    }

    if (!textValue) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ Please provide text value
        </div>
      `;
      resultBox.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/molecules/encode?tenant_id=${tenantId}&key=${encodeURIComponent(moleculeKey)}&value=${encodeURIComponent(textValue)}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      resultBox.innerHTML = `
        <div style="padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px;">
          <div style="font-weight: 600; color: #166534; margin-bottom: 6px;">✅ Success!</div>
          <div style="font-size: 13px; color: #166534;">
            <strong>v_ref_id:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${result.encoded_id}</code>
          </div>
        </div>
      `;
      resultBox.style.display = 'block';

    } catch (error) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ Error: ${error.message}
        </div>
      `;
      resultBox.style.display = 'block';
    }
  },

  // Test decodeMolecule
  testDecode: async function() {
    const API_BASE = 'http://localhost:4001';
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    const resultBox = document.getElementById('decodeResult');
    
    const moleculeKey = this.moleculeKey;
    const v_ref_id = document.getElementById('decode_v_ref_id').value.trim();

    if (!moleculeKey) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ No molecule selected. Please open test from a specific molecule.
        </div>
      `;
      resultBox.style.display = 'block';
      return;
    }

    if (!v_ref_id) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ Please provide v_ref_id
        </div>
      `;
      resultBox.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/molecules/decode?tenant_id=${tenantId}&key=${encodeURIComponent(moleculeKey)}&id=${v_ref_id}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      resultBox.innerHTML = `
        <div style="padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px;">
          <div style="font-weight: 600; color: #166534; margin-bottom: 6px;">✅ Success!</div>
          <div style="font-size: 13px; color: #166534;">
            <strong>Text Value:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${result.decoded_value}</code>
          </div>
        </div>
      `;
      resultBox.style.display = 'block';

    } catch (error) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ Error: ${error.message}
        </div>
      `;
      resultBox.style.display = 'block';
    }
  },

  // Test getMolecule
  testGetMolecule: async function() {
    const API_BASE = 'http://localhost:4001';
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    const resultBox = document.getElementById('getResult');
    
    const moleculeKey = this.moleculeKey;

    if (!moleculeKey) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ No molecule selected. Please open test from a specific molecule.
        </div>
      `;
      resultBox.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/molecules/get/${encodeURIComponent(moleculeKey)}?tenant_id=${tenantId}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      // Format the result nicely
      const formatted = JSON.stringify(result, null, 2);

      resultBox.innerHTML = `
        <div style="padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px;">
          <div style="font-weight: 600; color: #166534; margin-bottom: 6px;">✅ Success!</div>
          <div style="font-size: 12px; color: #166534;">
            <strong>Configuration:</strong>
            <pre style="
              background: white;
              padding: 8px;
              border-radius: 4px;
              margin: 6px 0 0 0;
              overflow-x: auto;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 11px;
              line-height: 1.4;
            ">${formatted}</pre>
          </div>
        </div>
      `;
      resultBox.style.display = 'block';

    } catch (error) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ Error: ${error.message}
        </div>
      `;
      resultBox.style.display = 'block';
    }
  },

  // Test getMoleculeValue (evaluate with context and date)
  testEvaluate: async function() {
    const API_BASE = 'http://localhost:4001';
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    const resultBox = document.getElementById('evaluateResult');
    
    const moleculeKey = this.moleculeKey;
    const memberId = document.getElementById('eval_member_id').value.trim();
    const date = document.getElementById('eval_date').value.trim();

    if (!moleculeKey) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ No molecule selected. Please open test from a specific molecule.
        </div>
      `;
      resultBox.style.display = 'block';
      return;
    }

    // Build query string
    let url = `${API_BASE}/v1/molecules/evaluate?tenant_id=${tenantId}&key=${encodeURIComponent(moleculeKey)}`;
    if (memberId) {
      url += `&member_id=${encodeURIComponent(memberId)}`;
    }
    if (date) {
      url += `&date=${encodeURIComponent(date)}`;
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      resultBox.innerHTML = `
        <div style="padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px;">
          <div style="font-weight: 600; color: #166534; margin-bottom: 6px;">✅ Success!</div>
          <div style="font-size: 13px; color: #166534;">
            <strong>Resolved Value:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${result.resolved_value !== null ? result.resolved_value : '(null)'}</code>
          </div>
          ${result.context.member_id ? `
            <div style="font-size: 12px; color: #059669; margin-top: 4px;">
              Context: member_id = ${result.context.member_id}
            </div>
          ` : ''}
          ${result.date ? `
            <div style="font-size: 12px; color: #059669; margin-top: 2px;">
              Date: ${result.date}
            </div>
          ` : ''}
        </div>
      `;
      resultBox.style.display = 'block';

    } catch (error) {
      resultBox.innerHTML = `
        <div style="padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ❌ Error: ${error.message}
        </div>
      `;
      resultBox.style.display = 'block';
    }
  },

  // Close the modal
  close: function() {
    const modal = document.getElementById('moleculeTestModal');
    if (modal) {
      modal.remove();
    }
  }
};
