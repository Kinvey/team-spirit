import { Injectable } from '@angular/core';
import { Data } from '../../node_modules/everlive-sdk/dist/declarations/everlive/types/Data';

import { EverliveProvider } from './';
import { Group, GroupMembership, User } from '../shared/models';
import { utilities } from '../shared';

@Injectable()
export class GroupsService {
    private _membershipsData: Data<GroupMembership>;
    private _groupsData: Data<Group>;
    private readonly _groupImageExpand: any = {
        Image: {
            TargetTypeName: 'Files',
            SingleField: 'Uri',
            ReturnAs: 'ImageUrl'
        }
    };
    private readonly _expandMemberships: any = {
        GroupId: {
            TargetTypeName: 'Groups',
            ReturnAs: 'Group',
            Expand: this._groupImageExpand
        }
    };
    
    constructor(
        private _elProvider: EverliveProvider
    ) {
        this._membershipsData = this._elProvider.getData<GroupMembership>('GroupMembers');
        this._groupsData = this._elProvider.getData<Group>('Groups');
    }

    create(group: Group) {
        return this._groupsData.create(group).then(res => res.result);
    }

    getById(id: string, expand = true) {
        if (expand) {
            this._groupsData.expand(this._groupImageExpand);
        }
        return this._groupsData.getById(id).then(r => r.result);
    }

    getAllVisible(userId: string) {
        let filter = {
            $or: [
                { IsPublic: true },
                { Owner: userId }
            ]
        };
        let userGroups: Group[];
        return this.getUserGroups(userId)
            .then(joinedGroups => {
                userGroups = joinedGroups;
                return this._getGroupsByFilter(filter);
            })
            .then(publicAndOwnedGroups => {
                return this._mergeGroups(publicAndOwnedGroups, userGroups);
            });
    }
    
    getUserGroups(userId: string) {
        let query = this._elProvider.getNewQuery();
        query.where({ UserId: userId });
        query.expand(this._expandMemberships);
        
        return this._membershipsData.get(query).then(r => r.result.map(gm => gm.Group));
    }
    
    isUserAMember(userId: string, groupId: string): Promise<boolean>
    isUserAMember(userId: string, group: Group): Promise<boolean>
    isUserAMember(user: User, groupId: string): Promise<boolean>
    isUserAMember(user: User, group: Group): Promise<boolean>
    isUserAMember(userData: string|User, groupData: string|Group): Promise<boolean> {
        let userId: string;
        let groupId: string;
        
        if (typeof userData === 'string') {
            userId = userData
        } else {
            userId = userData.Id;
        }

        if (typeof groupData === 'string') {
            groupId = groupData;
        } else {
            groupId = groupData.Id;
        }

        return this._membershipsData.get({ UserId: userId, GroupId: groupId })
            .then(resp => {
                return resp.count > 0;
            });
    }

    update(group: Group) {
        delete (<any>group).ImageUrl; // sanitize expanded field
        return this._groupsData.updateSingle(group).then(r => r.result);
    }

    delete(id: string) {
        return this._groupsData.destroySingle(id).then(r => r.result);
    }

    validateGroupEntry(group: Group) {
        let errMsg: string = null;

        if (!utilities.isNonemptyString(group.Name)) {
            errMsg = 'Group name is invalid';
        }

        return errMsg;
    }

    joinGroup(groupId: string, userId: string) {
        let queryStringParams = { userId, groupId };
        return this._elProvider.get.businessLogic.invokeCloudFunction('requestToJoinGroup', { queryStringParams });
    }

    leaveGroup(groupId: string, userId: string) {
        let query = this._elProvider.getNewQuery();
        query.where({
            UserId: userId,
            GroupId: groupId
        });
        return this._membershipsData.destroy(query).then(r => r.result);
    }

    private _mergeGroups(ownedAndPublic: Group[], joinedGroups: Group[]) {
        let joinedById: any = {};
        joinedGroups.forEach(jg => joinedById[jg.Id] = true);
        ownedAndPublic.forEach(g => {
            if (!joinedById[g.Id]) {
                joinedGroups.push(g);
            }
        });
        return joinedGroups;
    }

    private _getGroupsByFilter(filter: any) {
        let query = this._elProvider.getNewQuery();
        query.where(filter);
        query.expand(this._groupImageExpand);
        return this._groupsData.get(query).then(res => res.result);
    }
}