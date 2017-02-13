var rsvp = require('rsvp');
var Promise = rsvp.Promise;

Everlive.CloudFunction.onRequest(function(request, response, done) {
    getData(request.data)
        .then(function(context) {
            return rsvp.all([sendPush(request.data.alertType, context), sendEmail(context.email)]);
        })
        .then(done)
        .catch(function(err) {
            console.log('err: ' + JSON.stringify(err));
            done();
        });
});

// === COMMON ======================================================

function getEvent (eventId) {
    var el = Everlive.Sdk.withMasterKey();
    var eventsDB = el.data('Events');
    return eventsDB.getById(eventId);
}

function getUser (userId) {
    var el = Everlive.Sdk.withMasterKey();
    var usersDB = el.data('Users');
    return usersDB.getById(userId);
}

function getGroup (groupId) {
    var el = Everlive.Sdk.withMasterKey();
    var groupDB = el.data('Groups');
    return groupDB.getById(groupId);
}

function getGroupMembers (groupId) {
    var el = Everlive.Sdk.withMasterKey();
    var groupMembersDB = el.data('GroupMembers');
    
    var headers = {
        'x-everlive-single-field': 'UserId',
        'x-everlive-expand': '{ "UserId": { "TargetTypeName": "Users" } }'
    };
    return groupMembersDB.withHeaders(headers).get({ GroupId: groupId });
}

function getJoinReq(applicantId, groupId) {
    var el = Everlive.Sdk.withMasterKey();
    var groupDB = el.data('GroupJoinRequests');
    return groupDB.get({ ApplicantId: applicantId, GroupId: groupId });
}

function filterForNotification (users, skipUserId) {
    var recipients = [];
    var userIds = [];
    users.forEach(function(user) {
        if (!user || (skipUserId !== undefined && user.Id === skipUserId)) {
            return;
        }
        
        if (user.PushNotificationsEnabled) {
            userIds.push(user.Id);
        }

        if (user.EmailNotificationsEnabled) {
            recipients.push(user.Email);
        }
    });
    return {
        recipients: recipients,
        userIds: userIds
    };
}

function getDataForUserRegisteredForEvent (context) {
    var userId = context.userId;
    var eventId = context.eventId;
    var event, user, members;

    if (!userId || !eventId) {
        return rsvp.Promise.reject({ message: 'Missing user or event id' });
    }

    return getEvent(eventId)
        .then(function(eventResult) {
            event = eventResult.result;
            return getUser(userId);
        })
        .then(function(userResult) {
            user = userResult.result;
            return getGroupMembers(event.GroupId);
        })
        .then(function(getMemberEmailsResult) {
            var users = getMemberEmailsResult.result;
            var emailContext = { // TODO: this can be taken from context, but template needs to be redone
                UserName: user.DisplayName,
                EventName: event.Name
            };
            var userData = filterForNotification(users, userId);

            return {
                userName: user.DisplayName,
                eventName: event.Name,
                push: { userIds: userData.userIds },
                email: {
                    templateName: 'UserRegisteredForEvent',
                    recipients: userData.recipients,
                    context: emailContext
                }
            };
        });
}

function getDataForEventRelated (templateName, context) {
    var event, group, members;
    return Promise.all([getEvent(context.eventId), getGroup(context.groupId), getGroupMembers(context.groupId)])
        .then(function(results) {
            event = results[0].result;
            group = results[1].result;
            members = results[2].result;
            return getUser(event.OrganizerId);
        })
        .then(function(organizerRes) {
            var organizer = organizerRes.result;
            var userData = filterForNotification(members);
            var emailContext = {
                Event: event,
                GroupName: group.Name,
                Organizer: organizer.DisplayName
            };

            return {
                eventName: event.Name,
                groupName: group.Name,
                organizerName: organizer.DisplayName,
                push: { userIds: userData.userIds },
                email: {
                    templateName: templateName,
                    recipients: userData.recipients,
                    context: emailContext // TODO: this can be taken from context, but template needs to be redone
                }
            };
        });
}

function getDataForUserJoinedGroup (context) {
    var group, user;
    return getGroup(context.groupId)
        .then(function(groupRes) {
            group = groupRes.result;
            return getUser(context.userId);
        })
        .then(function(userRes) {
            user = userRes.result;
            return getGroupMembers(group.Id);
        })
        .then(function(membersRes) {
            var members = membersRes.result;
            var userData = filterForNotification(members, user.Id);
            var emailContext = {
                UserName: user.DisplayName,
                GroupName: group.Name
            };
            return {
                groupName: group.Name,
                userName: user.DisplayName,
                push: { userIds: userData.userIds },
                email: {
                    templateName: 'UserJoinedGroup',
                    recipients: userData.recipients,
                    context: emailContext // TODO: this can be taken from context, but template needs to be redone
                }
            };
        });
}

function getDataForUserAskedToJoinGroup (context) {
    var group, user, owner;
    return getGroup(context.groupId)
        .then(function(groupRes) {
            group = groupRes.result;
            return getUser(group.Owner);
        })
        .then(function(ownerRes) {
            owner = ownerRes.result;
            return getUser(context.userId);
        })
        .then(function(userRes) {
            user = userRes.result;
            return getJoinReq(user.Id, group.Id);
        })
        .then(function(reqRes) {
            var cloudFuncUrl = Everlive.Parameters.apiBaseUrlSecure + '/v1/' + Everlive.Parameters.apiKey
                + '/Functions/resolveUserJoinRequest?reqId=' + reqRes.result[0].Id // there should be exactly one
                // + 'applicantId=' + user.Id
                // + '&groupId=' + group.Id
                + '&approved=';
            var emailContext = {
                UserName: user.DisplayName,
                UserEmail: user.Email, // or Username - it is actually email
                GroupName: group.Name,
                ApproveLink: encodeURI(cloudFuncUrl + 'true'),
                DenyLink: encodeURI(cloudFuncUrl + 'false')
            };
            return {
                groupName: group.Name,
                userName: user.DisplayName,
                userEmail: user.Email,
                push: { userIds: [owner.Id] },
                email: {
                    templateName: 'UserAskedToJoinGroup',
                    recipients: [owner.Email], // or Username - it is actually email
                    context: emailContext
                }
            };
        });
}

function getDataForUserUnregisteredFromEvent (context) {
    var event, unregisteredUser, organizer;
    var promises = [
        getEvent(context.eventId),
        getUser(context.userId)
    ];

    return Promise.all(promises)
        .then(function(result) {
            event = result[0].result;
            unregisteredUser = result[1].result;
            if (!event || !unregisteredUser) {
                return Promise.reject({ message: 'Could not find event or user' });
            }
            return getUser(event.OrganizerId);
        })
        .then(function(resp) {
            organizer = resp.result;
            if (!organizer) {
                return Promise.reject({ message: 'Could not find organizer' });
            }
        })
        .then(function() {
            var userData = filterForNotification([organizer]);
            var emailContext = {
                User: unregisteredUser.DisplayName,
                Event: event.Name
            };

            // TODO: extract this part, lots of refactoring in this file :/
            return {
                eventName: event.Name,
                userName: unregisteredUser.DisplayName,
                push: { userIds: userData.userIds },
                email: {
                    templateName: 'UserUnregisteredFromEvent',
                    recipients: userData.recipients,
                    context: emailContext
                }
            };
        });
}

function getData (context) {
    return getterByAlertType['getDataFor' + context.alertType](context);
}

var getterByAlertType = {
    getDataForUserRegisteredForEvent: getDataForUserRegisteredForEvent,
    getDataForEventRegistrationOpen: getDataForEventRelated.bind(null, 'EventRegistrationOpen'),
    getDataForEventRegistrationClosed: getDataForEventRelated.bind(null, 'EventRegistrationClosed'),
    getDataForEventDatesUpdated: getDataForEventRelated.bind(null, 'EventDatesUpdated'),
    getDataForUserJoinedGroup: getDataForUserJoinedGroup,
    getDataForUserAskedToJoinGroup: getDataForUserAskedToJoinGroup,
    getDataForUserUnregisteredFromEvent: getDataForUserUnregisteredFromEvent
};

// === EMAIL ======================================================

function sendEmail (data) {
    if (!data.recipients || !data.recipients.length) {
        console.log('not sending email - no recipients');
        return rsvp.Promise.resolve();
    }
    
    return new rsvp.Promise(function(resolve, reject) {
        Everlive.Email.sendEmailFromTemplate(data.templateName, data.recipients, data.context, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// === PUSH ======================================================

function sendPush (alertType, context) {
    if (!context.push || !context.push.userIds || !context.push.userIds.length) {
        console.log('not sending push - no recipients');
        return rsvp.Promise.resolve();
    }
    
    var el = Everlive.Sdk.withMasterKey();
    var notifObject = getNotificationObject(alertType, context);
    return el.push.send(notifObject);
}

function getNotificationObject (alertType, context) {
    var title = '';
    var message = '';
    
    switch(alertType) {
        case 'EventRegistrationOpen':
            title = 'New event in "' + context.groupName + '"!';
            message = 'The event is ' + context.eventName + '.';
            break;
        case 'EventRegistrationClosed':
            title = 'Event "' + context.eventName + '" is now finalized!';
            message = 'All the details for "' + context.eventName + '" have been decided on.';
            break;
        case 'EventDatesUpdated':
            title = 'Event date options changed';
            message = 'The dates for ' + context.eventName + ' have changed. Please update your vote.';
            break;
        case 'UserRegisteredForEvent':
            title = 'Make room for one more!';
            message = context.userName + ' just registered for ' + context.eventName;
            break;
        case 'UserJoinedGroup':
            title = context.groupName + ' grows!' ;
            message = context.userName + ' has joined ' + context.groupName;
            break;
        case 'UserAskedToJoinGroup':
            title = 'New request to join ' + context.groupName;
            message = context.userName + ' asked to join ' + context.groupName;
            break;
        case 'UserUnregisteredFromEvent':
            title = context.userName + ' decided not to come';
            message = context.userName + ' is not coming to ' + context.eventName;
            break;


        default:
            title = 'New Message!';
            message = 'Well, we dont know what it is... :|';
            break;
    }
    
    return formNotification(title, message, context.push.userIds);
}

function formNotification (title, message, userIds) {
	return {
        Filter: { UserId: { $in: userIds } },
        Android: formAndroidNotification(title, message),
        IOS: formIosNotification(title, message)
    };
}

function formAndroidNotification(title, message, data) {
    var notif = {
        data: {
            title: title,
            message: message,
            sound: "default"
        }
    };
    
    if (data) {
    	notif.data = objAssign(notif.data, data);
    }
    
    return notif;
}

function formIosNotification(title, message, data) {
    var notif = {
        aps: {
            alert: {
                title: title,
                body: message
            }
        }
    };
    if (data) {
        notif = objAssign(notif, data);
    }
    return notif;
}

function objAssign (destObj, srcObj) {
    for (var prop in srcObj) {
        if (srcObj.hasOwnProperty(prop)) {
            destObj[prop] = srcObj[prop];
        }
    }
    return destObj;
}
