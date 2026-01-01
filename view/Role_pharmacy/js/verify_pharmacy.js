(function() {
    const $ = (sel) => document.querySelector(sel);

    // 🔹 ID ทั้งหมดนี้มีอยู่ใน index.html ใหม่แล้ว
    const loader = $("#viLoader");
    const pdfFrame = $("#pdfViewer");
    const pdfjsContainer = $("#pdfjsViewer");
    const canvas = $("#pdfCanvas");
    const ctx = canvas?.getContext("2d");
    const pdfFallback = $("#pdfFallback");
    const btnPrevPage = $("#btnPrevPage");
    const btnNextPage = $("#btnNextPage");
    const pageNumEl = $("#pageNum");
    const pageCountEl = $("#pageCount");
    const btnReload = $("#btnReload");
    const openExternal = $("#openExternal");
    const btnDownload = $("#btnDownload");
    const btnConfirm = $("#btnConfirm");
    const btnReject = $("#btnReject");
    const btnBack = $("#btnBack");

    // Stepper elements
    const stepperStatus = $(".stepper-status");
    const subtitleEl = $(".subtitle");
    const step1 = $(".step:nth-child(1)");
    const step2 = $(".step:nth-child(2)");

    // Get request_id from sessionStorage
    const requestId = sessionStorage.getItem('selectedRequestId');
    let currentRequest = null;
    let pdfUrl = null;

    // Function to update confirmation status display
    const updateConfirmationStatus = async () => {
        if (!currentRequest) return;

        const { confirmed_by_1, confirmed_by_2, status } = currentRequest;
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        
        // Use doctor_name if available (which is the format stored in confirmation)
        const currentUserName = currentUser.doctor_name || 
                                `${currentUser.F_Name || ''} ${currentUser.L_Name || ''}`.trim() ||
                                currentUser.username;

        // Debug logging to identify the issue
        console.log('🔍 Checking confirmation status:');
        console.log('  Current user name:', `"${currentUserName}"`);
        console.log('  Current user object:', currentUser);
        console.log('  confirmed_by_1:', `"${confirmed_by_1}"`);
        console.log('  confirmed_by_2:', `"${confirmed_by_2}"`);
        
        // Normalize strings for comparison (remove extra spaces, normalize case)
        const normalizeString = (str) => {
            if (!str) return '';
            return str.trim().replace(/\s+/g, ' ').toLowerCase();
        };
        
        const normalizedUserName = normalizeString(currentUserName);
        const normalizedConfirmed1 = normalizeString(confirmed_by_1);
        const normalizedConfirmed2 = normalizeString(confirmed_by_2);
        
        // Check if user already confirmed (robust comparison with normalization)
        const userAlreadyConfirmed = 
            (normalizedConfirmed1 && normalizedConfirmed1 === normalizedUserName) || 
            (normalizedConfirmed2 && normalizedConfirmed2 === normalizedUserName);
        
        console.log('  Normalized comparison:');
        console.log('    User:', `"${normalizedUserName}"`);
        console.log('    Confirmed 1:', `"${normalizedConfirmed1}"`);
        console.log('    Confirmed 2:', `"${normalizedConfirmed2}"`);
        console.log('  User already confirmed?:', userAlreadyConfirmed);

        // Count confirmations
        let confirmCount = 0;
        if (confirmed_by_1) confirmCount++;
        if (confirmed_by_2) confirmCount++;

        // Update stepper
        if (confirmCount >= 1) {
            step1?.classList.add('active', 'completed');
        }
        if (confirmCount >= 2) {
            step2?.classList.add('active', 'completed');
        }

        // Update status text based on new workflow
        if (status === 'done') {
            if (stepperStatus) stepperStatus.textContent = 'เสร็จสมบูรณ์ - ยืนยันครบ 2 คน';
            if (subtitleEl) subtitleEl.textContent = 'เอกสารได้รับการยืนยันแล้ว';
            btnConfirm.disabled = true;
        } else if (status === 'reject') {
            if (stepperStatus) stepperStatus.textContent = 'ถูกปฏิเสธ';
            if (subtitleEl) subtitleEl.textContent = 'เอกสารถูกปฏิเสธ';
            btnConfirm.disabled = true;
            btnReject.disabled = true;
        } else if (status === 'pending') {
            if (stepperStatus) stepperStatus.textContent = 'รอกรอกข้อมูล Alleles';
            if (subtitleEl) subtitleEl.textContent = 'ยังไม่มีข้อมูล Alleles';
            btnConfirm.disabled = true;
        } else if (status === 'need_1_confirmation' || status === 'need 1 confirmation') {
            if (stepperStatus) stepperStatus.textContent = 'รอการยืนยันจากอีก 1 คน';
            if (subtitleEl) subtitleEl.textContent = `เจ้าหน้าที่ ${confirmCount} / 2 ยืนยันแล้ว`;
            
            // Check if current user already confirmed
            if (userAlreadyConfirmed) {
                btnConfirm.disabled = true;
                btnConfirm.style.opacity = '0.5';
                btnConfirm.style.cursor = 'not-allowed';
                btnConfirm.style.backgroundColor = '#cccccc';
                btnConfirm.style.pointerEvents = 'none';
                btnConfirm.textContent = 'คุณได้ยืนยันแล้ว ✓';
                if (stepperStatus) stepperStatus.textContent = '✓ คุณยืนยันแล้ว - รอผู้อื่นยืนยัน';
                if (subtitleEl) subtitleEl.textContent = 'รอการยืนยันจากเจ้าหน้าที่อีก 1 คน';
                console.log('🚫 Button disabled - user already confirmed');
            } else {
                btnConfirm.disabled = false;
                btnConfirm.style.opacity = '1';
                btnConfirm.style.cursor = 'pointer';
                btnConfirm.style.backgroundColor = '';
                btnConfirm.style.pointerEvents = '';
                btnConfirm.textContent = 'ยืนยันรายงานผล (Confirm)';
                console.log('✅ Button enabled - user can confirm');
            }
        } else if (status === 'need_2_confirmation' || status === 'need 2 confirmation') {
            // No confirmations yet
            if (stepperStatus) stepperStatus.textContent = 'รอการยืนยันจาก 2 คน';
            if (subtitleEl) subtitleEl.textContent = 'เจ้าหน้าที่ 0 / 2 กำลังตรวจสอบไฟล์ PDF';
            // Check if this user somehow already confirmed (edge case)
            if (userAlreadyConfirmed) {
                btnConfirm.disabled = true;
                btnConfirm.style.opacity = '0.5';
                btnConfirm.style.cursor = 'not-allowed';
                btnConfirm.style.backgroundColor = '#cccccc';
                btnConfirm.style.pointerEvents = 'none';
                btnConfirm.textContent = 'คุณได้ยืนยันแล้ว ✓';
                if (stepperStatus) stepperStatus.textContent = '✓ คุณยืนยันแล้ว';
                console.log('🚫 Button disabled - user already confirmed');
            } else {
                btnConfirm.disabled = false;
                btnConfirm.style.opacity = '1';
                btnConfirm.style.cursor = 'pointer';
                btnConfirm.style.backgroundColor = '';
                btnConfirm.style.pointerEvents = '';
                btnConfirm.textContent = 'ยืนยันรายงานผล (Confirm)';
                console.log('✅ Button enabled - user can confirm');
            }
        } else {
            // Unknown status
            if (stepperStatus) stepperStatus.textContent = status || 'ไม่ทราบสถานะ';
            if (subtitleEl) subtitleEl.textContent = 'กรุณาตรวจสอบสถานะ';
            btnConfirm.disabled = true;
        }

        console.log('📊 Confirmation status:', { confirmCount, status, confirmed_by_1, confirmed_by_2 });
    };

    // Fetch test request data and PDF
    const fetchRequestData = async () => {
        if (!requestId) {
            console.error('❌ No request ID found in sessionStorage');
            showFallback();
            await Swal.fire({
                icon: 'error',
                title: 'ไม่พบข้อมูล',
                text: 'กรุณาเลือกรายการที่ต้องการตรวจสอบ',
            });
            return false;
        }

        try {
            // Get test request data
            currentRequest = await window.electronAPI.getTestRequestById(requestId);
            
            if (!currentRequest) {
                console.error('❌ Request not found for ID:', requestId);
                showFallback();
                await Swal.fire({
                    icon: 'error',
                    title: 'ไม่พบข้อมูล',
                    text: 'ไม่พบข้อมูลคำขอนี้ในระบบ',
                });
                return false;
            }

            console.log('📦 Current Request:', currentRequest);

            // Check if report data exists with pdf_path
            const report = currentRequest.report?.[0] || currentRequest.report;
            const pdfPath = report?.pdf_path;

            console.log('📄 Report data:', report);
            console.log('📄 PDF Path from report:', pdfPath);

            if (pdfPath) {
                console.log('🔍 Original pdf_path:', pdfPath);
                
                // Check if it's already a full URL (from Supabase Storage)
                if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
                    pdfUrl = pdfPath; // Use URL directly
                    console.log('✅ Using Supabase URL:', pdfUrl);
                } 
                // Check if it's a Supabase storage path format
                else if (pdfPath.includes('PDF_Bucket') || pdfPath.includes('storage/v1')) {
                    // It's a partial storage path, construct full URL
                    // Extract just the filename from the path
                    let fileName = pdfPath;
                    if (pdfPath.includes('/')) {
                        fileName = pdfPath.split('/').pop();
                    }
                    // Try different bucket configurations
                    pdfUrl = `https://vdktousokseslnzfhnzc.supabase.co/storage/v1/object/public/PDF_Bucket/${fileName}`;
                    console.log('✅ Constructed Supabase URL:', pdfUrl);
                    console.log('🔍 Extracted filename:', fileName);
                }
                // Check if it's just a filename
                else if (!pdfPath.includes('/')) {
                    // Just a filename, construct Supabase URL
                    // Try common bucket name variations
                    pdfUrl = `https://vdktousokseslnzfhnzc.supabase.co/storage/v1/object/public/pdf_bucket/${pdfPath}`;
                    console.log('✅ Constructed URL from filename (trying lowercase):', pdfUrl);
                    console.log('💡 If this fails, check bucket name in Supabase Storage dashboard');
                }
                // Otherwise treat as local file
                else {
                    if (pdfPath.includes('reports/')) {
                        pdfUrl = resolvePdfUrl(`../../${pdfPath}`);
                    } else {
                        pdfUrl = resolvePdfUrl(`../../reports/${pdfPath}`);
                    }
                    console.log('✅ Using local path:', pdfUrl);
                }
                
                // Test if URL is accessible
                console.log('🧪 Testing PDF URL accessibility...');
                return true;
            } 
            // Fallback: check Doc_Name if pdf_path doesn't exist
            else if (currentRequest.Doc_Name) {
                const docName = currentRequest.Doc_Name;
                
                console.log('⚠️ No pdf_path, using Doc_Name:', docName);
                
                if (docName.startsWith('http://') || docName.startsWith('https://')) {
                    pdfUrl = docName;
                    console.log('✅ Using Supabase URL from Doc_Name:', pdfUrl);
                } 
                else if (docName.includes('PDF_Bucket') || docName.includes('storage/v1')) {
                    const fileName = docName.split('/').pop();
                    pdfUrl = `https://vdktousokseslnzfhnzc.supabase.co/storage/v1/object/public/PDF_Bucket/${fileName}`;
                    console.log('✅ Constructed Supabase URL from Doc_Name:', pdfUrl);
                }
                else {
                    if (docName.includes('reports/')) {
                        pdfUrl = resolvePdfUrl(`../../${docName}`);
                    } else {
                        pdfUrl = resolvePdfUrl(`../../reports/${docName}`);
                    }
                    console.log('✅ Using local path from Doc_Name:', pdfUrl);
                }
                return true;
            } else {
                console.error('❌ No PDF path found in database');
                showFallback();
                await Swal.fire({
                    icon: 'warning',
                    title: 'ไม่พบไฟล์ PDF',
                    text: 'ยังไม่มีการอัปโหลดไฟล์ PDF สำหรับคำขอนี้',
                });
                return false;
            }
        } catch (error) {
            console.error('❌ Error fetching request data:', error);
            showFallback();
            await Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถดึงข้อมูลได้: ' + error.message,
            });
            return false;
        }
    };

    const resolvePdfUrl = (input) => {
        if (!input) return null;
        if (/^(file|https?):\/\//i.test(input)) return input;
        try {
            return new URL(input.replace(/\\/g, "/"), window.location.href).href;
        } catch {
            return input;
        }
    };

    const hideAll = () => {
        // 🔹 ใน HTML ใหม่
        // pdfjsContainer, pdfFrame, pdfFallback ทั้งหมดถูกซ่อนไว้โดย 'hidden' อยู่แล้ว
        // และ loader ก็จะถูกซ่อนโดยฟังก์ชันนี้
        pdfjsContainer.hidden = true;
        pdfFrame.hidden = true;
        pdfFallback.hidden = true;
        if (loader) loader.hidden = true;
    };

    const showFallback = () => {
        hideAll();
        pdfFallback.hidden = false;
    };

    const enableIframe = (url) => {
        console.log('🖼️ Loading PDF in iframe:', url);
        
        // Test if URL is accessible before loading
        fetch(url, { method: 'HEAD' })
            .then(response => {
                console.log('📡 URL accessibility check:', {
                    status: response.status,
                    ok: response.ok,
                    statusText: response.statusText,
                    contentType: response.headers.get('content-type')
                });
                
                if (!response.ok) {
                    console.error('❌ URL is not accessible:', response.status, response.statusText);
                    Swal.fire({
                        icon: 'error',
                        title: 'ไม่พบไฟล์ PDF',
                        text: `ไม่สามารถเข้าถึงไฟล์ได้ (${response.status}: ${response.statusText})\n\nURL: ${url}`,
                        footer: 'กรุณาตรวจสอบว่าไฟล์มีอยู่ใน Supabase Storage'
                    });
                    showFallback();
                }
            })
            .catch(err => {
                console.error('❌ Failed to check URL accessibility:', err);
            });
        
        hideAll();
        pdfFrame.hidden = false;
        pdfFrame.src = url;

        // Add download and open in new tab functionality
        if (openExternal) openExternal.href = url;
        if (btnDownload) {
            btnDownload.onclick = () => {
                const a = document.createElement("a");
                a.href = url;
                a.download = url.split("/").pop() || "document.pdf";
                a.click();
            };
        }

        const onFail = (e) => {
            console.error('❌ Iframe failed to load:', e);
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถแสดง PDF',
                html: `ไม่สามารถโหลดไฟล์ PDF ได้<br><br><small>${url}</small>`,
                footer: 'ลองคลิก "เปิดแท็บใหม่" เพื่อดูในเบราว์เซอร์'
            });
            showFallback();
        };
        
        const onLoad = () => {
            console.log('✅ Iframe loaded successfully');
            // 🔹 เมื่อ Iframe โหลดเสร็จ ก็ซ่อน Loader และเปิดปุ่ม
            hideAll();
            pdfFrame.hidden = false;
            // Don't enable confirm button here - let updateConfirmationStatus handle it
        };

        pdfFrame.addEventListener("error", onFail, { once: true });
        pdfFrame.addEventListener("load", onLoad, { once: true });
    };

    const initPdfJs = async (url) => {
        if (!canvas || !ctx) return false;

        // 🔹 Skip PDF.js for Supabase URLs - use iframe instead for better compatibility
        if (url.includes('supabase.co')) {
            console.log('🔄 Supabase URL detected - skipping PDF.js, will use iframe');
            return false;
        }

        // 🔹 ใช้ CDN ของ PDF.js เหมือนเดิม
        const CDN_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105";
        const loadScript = (src) =>
            new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });

        try {
            if (!window.pdfjsLib) {
                await loadScript(`${CDN_BASE}/pdf.min.js`);
            }
            // 🔹 แก้ไข: ตรวจสอบ worker ให้ถูกต้อง
            if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                await loadScript(`${CDN_BASE}/pdf.worker.min.js`);
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN_BASE}/pdf.worker.min.js`;
            }

            const pdf = await window.pdfjsLib.getDocument(url).promise;
            let currentPage = 1;
            const totalPages = pdf.numPages;
            pageCountEl.textContent = String(totalPages);

            const renderPage = async (num) => {
                // 🔹 ทำให้ปุ่ม Active/Inactive
                btnPrevPage.disabled = (num <= 1);
                btnNextPage.disabled = (num >= totalPages);

                const page = await pdf.getPage(num);

                // 🔹 ปรับปรุง: ใช้ clientWidth ของ parent shell
                const containerWidth = canvas.parentElement.clientWidth - 30; // 30 = padding
                const viewport = page.getViewport({ scale: 1 });
                const scale = Math.max(0.35, containerWidth / viewport.width);
                const scaledViewport = page.getViewport({ scale });
                canvas.width = Math.floor(scaledViewport.width);
                canvas.height = Math.floor(scaledViewport.height);
                await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
                pageNumEl.textContent = String(num);
            };

            btnPrevPage?.addEventListener("click", () => {
                if (currentPage > 1) {
                    currentPage -= 1;
                    renderPage(currentPage);
                }
            });

            btnNextPage?.addEventListener("click", () => {
                if (currentPage < totalPages) {
                    currentPage += 1;
                    renderPage(currentPage);
                }
            });

            let resizeTimer;
            window.addEventListener("resize", () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => renderPage(currentPage), 160);
            });

            // 🔽 [จุดแก้ไขที่ 1: ตรรกะการแสดงผล]
            // เราจะสั่งให้ render หน้าแรกให้เสร็จ *ก่อน*
            // ถ้าสำเร็จ ค่อยซ่อน Loader และแสดงผล
            

            // ถ้า render สำเร็จ:
            hideAll(); // ซ่อน Loader
            pdfjsContainer.hidden = false; // แสดง PDF.js

            await renderPage(currentPage); // ลอง render ก่อน
            
            // ย้ายมาไว้ตรงนี้
            openExternal.href = url;
            btnDownload?.addEventListener("click", () => {
                const a = document.createElement("a");
                a.href = url;
                a.download = url.split("/").pop() ?? "document.pdf";
                a.click();
            });

            return true;

        } catch (error) {
            console.warn("PDF.js failed, fallback to iframe", error);
            
            // 🔽 [จุดแก้ไขที่ 2: เพิ่ม hideAll() ใน catch]
            // ถ้าล้มเหลว (ไม่ว่าจะขั้นตอนไหน) สั่งซ่อนทุกอย่าง
            hideAll();
            return false;
        }
    };

    btnReload?.addEventListener("click", () => window.location.reload());

    // Main initialization
    (async () => {
        try {
            // 1. Fetch request data and PDF URL from database
            const hasData = await fetchRequestData();
            
            if (!hasData || !pdfUrl) {
                console.error('❌ No PDF URL available');
                showFallback();
                return;
            }

            console.log('📄 Loading PDF:', pdfUrl);

            // 2. Update confirmation status display
            await updateConfirmationStatus();

            // 3. Try to load PDF with PDF.js
            const ok = await initPdfJs(pdfUrl);

            if (ok) {
                // PDF.js successful - confirmation button state already set by updateConfirmationStatus
                console.log('✅ PDF.js loaded successfully');
            } else {
                // PDF.js failed - try iframe
                console.log('📄 Trying iframe fallback');
                enableIframe(pdfUrl);
            }
        } catch (error) {
            console.error('❌ Initialization error:', error);
            showFallback();
        }
    })();

    btnConfirm?.addEventListener("click", async () => {
        if (!currentRequest) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลคำขอ', 'error');
            return;
        }

        // Get current user from session
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        if (!currentUser.user_id) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่', 'error');
            return;
        }

        // Use doctor_name if available (which is the format stored in confirmation)
        const currentUserName = currentUser.doctor_name || 
                                `${currentUser.F_Name || ''} ${currentUser.L_Name || ''}`.trim() ||
                                currentUser.username;
        
        // Normalize strings for comparison
        const normalizeString = (str) => {
            if (!str) return '';
            return str.trim().replace(/\s+/g, ' ').toLowerCase();
        };
        
        const normalizedUserName = normalizeString(currentUserName);
        const normalizedConfirmed1 = normalizeString(currentRequest.confirmed_by_1);
        const normalizedConfirmed2 = normalizeString(currentRequest.confirmed_by_2);
        
        // Check if user already confirmed (robust comparison with normalization)
        const userAlreadyConfirmed = 
            (normalizedConfirmed1 && normalizedConfirmed1 === normalizedUserName) || 
            (normalizedConfirmed2 && normalizedConfirmed2 === normalizedUserName);
        
        console.log('🔍 Confirm button clicked - checking:', {
            currentUserName,
            normalizedUserName,
            confirmed_by_1: currentRequest.confirmed_by_1,
            confirmed_by_2: currentRequest.confirmed_by_2,
            normalizedConfirmed1,
            normalizedConfirmed2,
            userAlreadyConfirmed
        });
        
        if (userAlreadyConfirmed) {
            Swal.fire({
                icon: 'warning',
                title: 'คุณยืนยันแล้ว',
                text: 'คุณได้ทำการยืนยันเอกสารนี้ไปแล้ว ต้องให้เจ้าหน้าที่คนอื่นยืนยัน',
                confirmButtonText: 'รับทราบ'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันการตรวจสอบ',
            html: `
                <p>ยืนยันว่าข้อมูลในเอกสารถูกต้องใช่หรือไม่?</p>
                <div style="text-align: left; margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                    <strong>รหัสคำขอ:</strong> ${currentRequest.request_id}<br>
                    <strong>ผู้ป่วย:</strong> ${currentRequest.patient?.first_name || ''} ${currentRequest.patient?.last_name || ''}<br>
                    <strong>การตรวจ:</strong> ${currentRequest.test_target || '-'}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ใช่, ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            // Call API to confirm
            const confirmResult = await window.electronAPI.confirmTestRequest(
                currentRequest.request_id,
                currentUser.user_id
            );

            if (confirmResult.success) {
                await Swal.fire({
                    title: 'สำเร็จ!',
                    html: `
                        <p>${confirmResult.message}</p>
                        <p style="margin-top: 10px; font-size: 14px; color: #666;">
                            <i class="fas fa-file-pdf"></i> PDF ได้รับการอัปเดตพร้อมลายเซ็นของคุณแล้ว
                        </p>
                    `,
                    icon: 'success',
                    confirmButtonText: 'ตกลง'
                });
                // Navigate back to information page
                window.electronAPI?.navigate('information_pharmacy');
            } else {
                Swal.fire({
                    title: 'ไม่สามารถยืนยันได้',
                    text: confirmResult.message,
                    icon: 'warning'
                });
            }
        }
    });

    btnReject?.addEventListener("click", async () => {
        if (!currentRequest) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลคำขอ', 'error');
            return;
        }

        // Get current user from session
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        if (!currentUser.user_id) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่', 'error');
            return;
        }

        const result = await Swal.fire({
            title: 'ปฏิเสธเอกสาร',
            html: `
                <div style="text-align: left; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                    <strong>รหัสคำขอ:</strong> ${currentRequest.request_id}<br>
                    <strong>ผู้ป่วย:</strong> ${currentRequest.patient?.first_name || ''} ${currentRequest.patient?.last_name || ''}
                </div>
            `,
            input: 'textarea',
            inputLabel: 'โปรดระบุเหตุผลในการปฏิเสธ',
            inputPlaceholder: 'กรอกเหตุผล...',
            inputAttributes: {
                'aria-label': 'กรอกเหตุผลในการปฏิเสธ'
            },
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ปฏิเสธ',
            cancelButtonText: 'ยกเลิก',
            inputValidator: (value) => {
                if (!value) {
                    return 'กรุณาระบุเหตุผล'
                }
            }
        });

        if (result.isConfirmed && result.value) {
            // Call API to reject
            const rejectResult = await window.electronAPI.rejectTestRequest(
                currentRequest.request_id,
                currentUser.user_id,
                result.value
            );

            if (rejectResult.success) {
                await Swal.fire({
                    title: 'ปฏิเสธแล้ว',
                    text: rejectResult.message,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                // Navigate back to information page
                window.electronAPI?.navigate('information_pharmacy');
            } else {
                Swal.fire({
                    title: 'ข้อผิดพลาด',
                    text: rejectResult.message || 'ไม่สามารถปฏิเสธได้',
                    icon: 'error'
                });
            }
        }
    });

    btnBack?.addEventListener("click", () => {
        // Navigate back to information page
        window.electronAPI?.navigate('information_pharmacy');
    });
})();

// Initialize user profile features (dropdown, logout, profile link, etc.)
if (typeof initializeUserProfile === 'function') {
    initializeUserProfile();
}
