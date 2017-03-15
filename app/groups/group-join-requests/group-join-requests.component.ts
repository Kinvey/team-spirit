import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterExtensions } from 'nativescript-angular/router';
import { Page } from 'ui/page';

import { EventsService, GroupsService, AlertService, PlatformService } from '../../services';
import { GroupJoinRequest } from '../../shared/models';
import { utilities } from '../../shared';

@Component({
    moduleId: module.id,
    selector: 'group-join-requests',
    templateUrl: './group-join-requests.template.html',
    styleUrls: ['./group-join-requests.component.css']
})
export class GroupJoinRequestsComponent implements OnInit {
    requests: GroupJoinRequest[];
    isAndroid: boolean = false;
    private _groupId: string;
    private _currPage: number = 0;
    private _pageSize: number = 10;
    private _totalCount: number = null;
    private _hasResolvedSome: boolean = false;

    constructor(
        private _page: Page,
        private _route: ActivatedRoute,
        private _platform: PlatformService,
        private _alertsService: AlertService,
        private _groupsService: GroupsService,
        private _routerExtensions: RouterExtensions,
        private _changeDetectionRef: ChangeDetectorRef
    ) {
        this.isAndroid = this._platform.isAndroid;
    }
    
    ngOnInit() {
        this._page.actionBar.title = 'Requests';
        this._route.params.subscribe(p => {
            this._groupId = p['id'];
            this._groupsService.getUnresolvedRequestsCount(this._groupId)
                .then((count: any) => this._totalCount = count)
                .catch(err => err && this._alertsService.showError(err.message));
            
            this._loadRequests();
        });
    }

    onBack() {
        let clearHistory = this._hasResolvedSome;
        let transition = utilities.getReversePageTransition();
        this._routerExtensions.navigate([`/groups/${this._groupId}`], { transition, clearHistory });
    }

    hasMore() {
        return this._totalCount > 0 && this.requests.length < this._totalCount; // null > 0 is false
    }

    onLoadMore() {
        this._loadRequests();
    }

    getTimeSinceCreation(creationDate: Date) {
        return `(${utilities.getRelativeTimeText(creationDate)})`;
    }

    resolve(request: GroupJoinRequest, approve: boolean) {
        this._groupsService.resolveJoinRequest(request.Id, approve)
            .then((resp) => {
                request.Approved = approve;
                request.Resolved = true;
                this._hasResolvedSome = true;
            })
            .catch(err => err && this._alertsService.showError(err.message));
    }

    getApprovalText(request: GroupJoinRequest) {
        let text = request.Approved ? 'Approved' : 'Denied';
        return text;
    }

    private _loadRequests() {
        return this._groupsService.getRequests(this._groupId, this._currPage, this._pageSize)
            .then(requests => {
                this.requests = (this.requests || []).concat(requests);
                this._currPage++;
            })
            .catch(err => err && this._alertsService.showError(err.message));
    }
}
