/* ============================================
   📄 SHOW PDF PAGE - Pharmacy
   Display completed PDF reports
   ============================================ */

(function() {
    const pdfFrame = document.getElementById('pdfFrame');
    const downloadLink = document.getElementById('downloadPdf');
    
    // Get request_id from sessionStorage
    const requestId = sessionStorage.getItem('selectedRequestId');
    const patientName = sessionStorage.getItem('selectedPatientName') || 'Patient';
    
    let pdfUrl = null;
    let currentRequest = null;

    // Fetch test request data and PDF
    const fetchRequestData = async () => {
        if (!requestId) {
            console.error('❌ No request ID found in sessionStorage');
            await Swal.fire({
                icon: 'error',
                title: 'ไม่พบข้อมูล',
                text: 'กรุณาเลือกรายการที่ต้องการดู',
            });
            window.electronAPI?.navigate('information_pharmacy');
            return false;
        }

        try {
            console.log('📦 Fetching request data for ID:', requestId);
            
            // Get test request data
            currentRequest = await window.electronAPI.getTestRequestById(requestId);
            
            if (!currentRequest) {
                console.error('❌ Request not found for ID:', requestId);
                await Swal.fire({
                    icon: 'error',
                    title: 'ไม่พบข้อมูล',
                    text: 'ไม่พบข้อมูลคำขอนี้ในระบบ',
                });
                window.electronAPI?.navigate('information_pharmacy');
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
                    pdfUrl = pdfPath;
                    console.log('✅ Using Supabase URL:', pdfUrl);
                } 
                // Check if it's a Supabase storage path format
                else if (pdfPath.includes('PDF_Bucket') || pdfPath.includes('storage/v1')) {
                    // Extract filename from the path
                    let fileName = pdfPath;
                    if (pdfPath.includes('/')) {
                        fileName = pdfPath.split('/').pop();
                    }
                    // Construct full URL
                    pdfUrl = `https://vdktousokseslnzfhnzc.supabase.co/storage/v1/object/public/PDF_Bucket/${fileName}`;
                    console.log('✅ Constructed Supabase URL:', pdfUrl);
                }
                // Check if it's just a filename
                else if (!pdfPath.includes('/')) {
                    pdfUrl = `https://vdktousokseslnzfhnzc.supabase.co/storage/v1/object/public/PDF_Bucket/${pdfPath}`;
                    console.log('✅ Constructed URL from filename:', pdfUrl);
                }
                // Local file path
                else {
                    if (pdfPath.includes('reports/')) {
                        pdfUrl = `file:///${__dirname}/../../${pdfPath}`.replace(/\\/g, '/');
                    } else {
                        pdfUrl = `file:///${__dirname}/../../reports/${pdfPath}`.replace(/\\/g, '/');
                    }
                    console.log('✅ Using local path:', pdfUrl);
                }
                
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
                        pdfUrl = `file:///${__dirname}/../../${docName}`.replace(/\\/g, '/');
                    } else {
                        pdfUrl = `file:///${__dirname}/../../reports/${docName}`.replace(/\\/g, '/');
                    }
                    console.log('✅ Using local path from Doc_Name:', pdfUrl);
                }
                return true;
            } else {
                console.error('❌ No PDF path found in database');
                await Swal.fire({
                    icon: 'warning',
                    title: 'ไม่พบไฟล์ PDF',
                    text: 'ยังไม่มีการอัปโหลดไฟล์ PDF สำหรับคำขอนี้',
                });
                window.electronAPI?.navigate('information_pharmacy');
                return false;
            }
        } catch (error) {
            console.error('❌ Error fetching request data:', error);
            await Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถดึงข้อมูลได้: ' + error.message,
            });
            window.electronAPI?.navigate('information_pharmacy');
            return false;
        }
    };

    // Load PDF in iframe
    const loadPdfInIframe = (url) => {
        console.log('🖼️ Loading PDF in iframe:', url);
        
        pdfFrame.src = url;
        
        // Set up download link
        if (downloadLink) {
            downloadLink.href = url;
            downloadLink.download = url.split('/').pop() || 'report.pdf';
        }

        // Handle iframe load events
        pdfFrame.addEventListener('load', () => {
            console.log('✅ PDF loaded successfully in iframe');
        });

        pdfFrame.addEventListener('error', (e) => {
            console.error('❌ Failed to load PDF:', e);
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถแสดง PDF',
                html: `ไม่สามารถโหลดไฟล์ PDF ได้<br><br><small>${url}</small>`,
                footer: 'กรุณาลองใหม่อีกครั้ง'
            });
        });
    };

    // Main initialization
    (async () => {
        try {
            // Update title with patient name
            const windowTitle = document.querySelector('.pdf-window-title');
            if (windowTitle && patientName) {
                windowTitle.textContent = `เอกสารผลตรวจ - ${patientName}`;
            }

            // Fetch request data and PDF URL from database
            const hasData = await fetchRequestData();
            
            if (!hasData || !pdfUrl) {
                console.error('❌ No PDF URL available');
                return;
            }

            console.log('📄 Loading PDF:', pdfUrl);

            // Load PDF in iframe
            loadPdfInIframe(pdfUrl);

        } catch (error) {
            console.error('❌ Initialization error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถโหลดไฟล์ PDF ได้'
            });
        }
    })();
})();
