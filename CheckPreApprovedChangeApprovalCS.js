        /**
         *@NApiVersion 2.x
        *@NScriptType ClientScript
        */
        define(['N/record', 'N/search', 'N/runtime', 'N/ui/message'],
            function(record, search, runtime, message) {
                
                // Check for Approved Change Approval Request
                function getApprovedChangeRequest(employeeId, changeType) {
                    log.debug('employeeId', employeeId);
                    log.debug('changeType', changeType);
                    // Look for Approved and 
                    var mySearch = search.create({
                        type: 'customrecord_change_approval_request',
                        columns: ['custrecord_cr_change_type', 'custrecord_cr_approval_status', 'custrecord_cr_completion_status'],
                        filters: [
                                    ['custrecord_cr_affected_employee', 'is', employeeId] // Affected Employee
                                    ,'and', 
                                    ['custrecord_cr_change_type', 'is', changeType] // Matching Change Type
                                    ,'and', 
                                    ['custrecord_cr_approval_status', 'is', 3] // Approved
                                    ,'and', 
                                    ['custrecord_cr_completion_status', 'is', 1] // Open
                                ]
                    });
                
                    var approvalResult = mySearch.run().getRange({
                        start: 0,
                        end: 1
                    });

                    log.debug('approvalResult', JSON.stringify(approvalResult));

                    // Check for Policy Approver Types
                    if(approvalResult.length > 0 && approvalResult[0]) {
                        return approvalResult[0];
                    }
                    
                    return null;
                }

                // Get Policy Approver and Assign to Change Approval
                function saveRecord(context) {
                    var newRecord = context.currentRecord;
                    log.debug('currentRecord', JSON.stringify(newRecord));

                    var recordType = newRecord.getValue({fieldId: 'type'});
                    log.debug('recordType', recordType);
                    var currentUser = runtime.getCurrentUser().id;

                    var approvedCR = getApprovedChangeRequest(currentUser, recordType.toLowerCase() == 'vendor' ? 1 : 2);
                    log.debug('approvedCR', JSON.stringify(approvedCR));

                    if(approvedCR != null) {
                        // Set Change Approval Request to Completed so it cannot be used again
                        var approvalRecord = record.load({
                            type: 'customrecord_change_approval_request',
                            id: newRecord.id
                        });
                        if(approvalRecord) {
                            approvalRecord.setValue('custrecord_cr_completion_status', 2);
                            var approvalRecordId = approvalRecord.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });
                        }
                    }
                    else {
                        // Show warning message requiring a Change Approval Request
                        var myMsg = message.create({
                            title: "Warning!", 
                            message: "You will need a Change Approval Request to EDIT this record!", 
                            type: message.Type.WARNING
                        });
                        
                        // Message disappears after 10 seconds
                        myMsg.show({
                            duration: 10000
                        }); 

                        return false;
                    }

                    return true;
                }

                return {
                    saveRecord: saveRecord,
                };
            });