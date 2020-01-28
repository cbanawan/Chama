    /**
     *@NApiVersion 2.x
     *@NScriptType UserEventScript
    */
    define(['N/record', 'N/search', 'N/runtime'],
        function(record, search, runtime) {
            
            // Get the list of Policy Approvers by Change Type
            function getPolicyApprovers(changeType) {
                var policyApprovers = [];

                // Get the default Policy Approver record
                var mySearch = search.create({
                    type: 'customrecord_change_approval_policy',
                    columns: ['custrecord_finance_approvers', 'custrecord_sales_manager_approvers'],
                    filters: ['custrecord_is_default_policy', 'is', 'T']
                });
            
                var policyResult = mySearch.run().getRange({
                    start: 0,
                    end: 1
                });

                // Check for Policy Approver Types
                if(policyResult.length > 0 && policyResult[0]) {
                    var approvers = [];

                    // Vendor
                    if(changeType == 1) {
                        approvers = policyResult[0].getValue({name: 'custrecord_finance_approvers'});
                    }
                    // Customer
                    else {
                        approvers =  policyResult[0].getValue({name: 'custrecord_sales_manager_approvers'});
                    }

                    // Convert results to Integer and into an array
                    approvers = approvers.split(',');
                    for(var i in approvers) {
                        policyApprovers.push(parseInt(approvers[i]));
                    }
                }
                
                return policyApprovers;
            }

            // Get Policy Approver and Assign to Change Approval
            function beforeSubmit(context) {
                var newApproval = context.newRecord;

                // On Create
                if(context.type === context.UserEventType.CREATE) {
                    // Get the change type
                    var approvalChangeType = newApproval.getValue({fieldId: 'custrecord_cr_change_type'});
                    
                    // Get the Policy Approvers
                    var policyApprovers = getPolicyApprovers(approvalChangeType);
    
                    // Set Policy Approvers as Mandatory Approvers of CR
                    newApproval.setValue('custrecord_cr_mandated_approvers', policyApprovers);
    
                    // Set all other fields' default
                    newApproval.setText('custrecord_cr_approval_status', 'Pending Approval');
                    newApproval.setText('custrecord_cr_completion_status', 'Open');    
                }
                // On Edit
                else if(context.type === context.UserEventType.EDIT){
                    var oldRecord = context.oldRecord;

                    // Mandated Approvers
                    var mandatedApprovers = oldRecord.getValue({fieldId: 'custrecord_cr_mandated_approvers'});
                    for(var i in mandatedApprovers) {
                        mandatedApprovers[i] = parseInt(mandatedApprovers[i]);
                    }

                    // Currently logged In User
                    var currentUser = runtime.getCurrentUser().id;

                    // Approval Status Changes
                    var previousApprovalStatus = oldRecord.getText({fieldId: 'custrecord_cr_approval_status'});
                    var currentApprovalStatus = newApproval.getText({fieldId: 'custrecord_cr_approval_status'});

                    // Current User is a Mandatory Approver
                    if(mandatedApprovers.indexOf(currentUser) > -1) {
                        // Approval Status has changed
                        if(previousApprovalStatus !== currentApprovalStatus) {
                            var currentApprovers = [];
                            var oldApprovers = oldRecord.getValue({fieldId: 'custrecord_cr_approved_by'});
                            if(oldApprovers != 0) {
                                // Transform array String to Integer
                                for(var i in oldApprovers) {
                                    currentApprovers.push(parseInt(oldApprovers[i]));
                                }
                            }

                            if(currentApprovalStatus == 'Approved') {
                                // Add Approver to Approved By list
                                if(currentApprovers.indexOf(currentUser) < 0) {
                                    currentApprovers.push(currentUser);
                                    newApproval.setValue('custrecord_cr_approved_by', currentApprovers);
                                }

                                // Set the Approval Date
                                newApproval.setValue('custrecord_cr_approved_date', new Date());

                                // Check if ALL Mandated Approvers have already approved
                                if(mandatedApprovers.length !== currentApprovers) {
                                    // Approval not yet complete. Revert to Pending Approval.
                                    newApproval.setText('custrecord_cr_approval_status', 'Pending Approval');
                                }
                            }
                            else if(currentApprovalStatus == 'Rejected') {
                                // Add Approver to Approved By list
                                if(currentApprovers.indexOf(currentUser) < 0) {
                                    currentApprovers.push(currentUser);
                                    newApproval.setValue('custrecord_cr_approved_by', currentApprovers);
                                }

                                // Date Rejected
                                newApproval.setValue('custrecord_cr_approved_date', new Date());                                
                            }
                        }
                    }
                    else {
                        // Revert to old Approval Status
                        if(previousApprovalStatus !== currentApprovalStatus && currentApprovalStatus !== 'Pending Approval') {
                            newApproval.setText('custrecord_cr_approval_status', previousApprovalStatus);
                        }
                    }
                }
            }

            return {
                beforeSubmit: beforeSubmit,
            };
        });