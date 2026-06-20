# document-file-upload

Self-contained `FileUploadField` React component for M1 document forms. Supports drag-and-drop and click-to-select, inline client-side validation (type and size), simulated upload progress via `setTimeout` cascade, existing-file preview for edit mode, and a clear/replace button. The component exposes a simple `onChange(file: File | null)` callback — it does not call APIs itself. The MSW handler for `POST /api/documents/:id/upload` is also owned by this capability.

## Requirements

### Requirement: FileUploadField accepts files via drag-and-drop and click
The `FileUploadField` component SHALL render a drop zone that accepts file drops and also opens the native file picker on click. Accepted file types are PDF, DOCX, and XLSX only (MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Maximum file size is 10 MB.

#### Scenario: User drops a valid PDF file
- **WHEN** the user drags and drops a PDF file onto the drop zone
- **THEN** the file is accepted, its name and size are displayed, and no error is shown

#### Scenario: User clicks to open file picker
- **WHEN** the user clicks the drop zone
- **THEN** the native file picker opens filtered to accepted file types

### Requirement: FileUploadField validates file type and size inline without API call
Before triggering any upload, the component SHALL validate the selected file locally. If the file type is not in the accepted list, it SHALL display `t('documents:form.error_file_type')`. If the file size exceeds 10 MB, it SHALL display `t('documents:form.error_file_size')`. In both cases, no API call is made and the file is rejected.

#### Scenario: File type not allowed shows inline error
- **WHEN** the user selects a `.txt` or other unsupported file
- **THEN** an inline error message appears below the drop zone and the file is not stored

#### Scenario: File exceeds 10 MB shows inline error
- **WHEN** the user selects a file larger than 10 485 760 bytes (10 MiB)
- **THEN** an inline error message appears below the drop zone and the file is not stored

#### Scenario: Valid file clears previous error
- **WHEN** a previous invalid file was rejected and the user then selects a valid file
- **THEN** the error message is cleared and the new file name and size are displayed

### Requirement: FileUploadField shows simulated upload progress
After a valid file is selected (not on drop or pick — on form submit trigger), the component SHALL display a progress bar that animates from 0 to 100% over approximately 1.5 seconds using a `setTimeout`-based cascade. The component SHALL clean up all pending timeouts on unmount to prevent state updates after unmount.

#### Scenario: Progress bar completes after selection
- **WHEN** a valid file is selected and upload is triggered
- **THEN** a progress bar appears and fills to 100% over ~1.5 seconds

#### Scenario: No memory leak on unmount during upload
- **WHEN** the component unmounts while upload progress is running
- **THEN** no React state update warnings occur (timeouts are cleared in cleanup)

### Requirement: FileUploadField displays existing file in edit mode
When an `existingFileUrl` prop is provided (document already has an `archivoUrl`), the component SHALL display the filename extracted from the URL and a "Reemplazar archivo" link that resets the field to allow a new upload. No progress bar is shown for the existing file.

#### Scenario: Existing file name shown in edit mode
- **WHEN** `FileUploadField` receives a non-null `existingFileUrl` prop
- **THEN** the filename portion of the URL is displayed and a replace option is visible

#### Scenario: Replace link resets to empty state
- **WHEN** the user clicks the replace link
- **THEN** the displayed filename is cleared and the drop zone becomes active again

### Requirement: FileUploadField exposes a clear/replace button
After a file has been selected, the component SHALL render a button to remove the selected file and return to the empty drop zone state.

#### Scenario: Clear button removes selected file
- **WHEN** the user has selected a valid file and clicks the clear button
- **THEN** the file is removed, the drop zone is shown again, and no error remains

### Requirement: MSW handler for POST /api/documents/:id/upload
The MSW handler at `POST /api/documents/:id/upload` SHALL respond after 800 ms with a success response containing `archivoUrl` (formatted as `/mock/uploads/{id}/{originalFilename}`) and `hashArchivo` (a 64-character lowercase hex string). The handler SHALL NOT attempt to parse the multipart request body.

#### Scenario: Upload handler returns mock archivoUrl and hashArchivo
- **WHEN** `POST /api/documents/:id/upload` is called
- **THEN** after 800 ms, the response includes `archivoUrl` and a 64-char hex `hashArchivo`
