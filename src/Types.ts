export interface InitialUserState {
    user: {
        uid: string;
        photo: string;
        email: string;
        displayName: string;
    } | null;
    isAuthChecking: boolean;
}
export interface InitialChannelState {
    channelId: string | null;
    channelName: string | null;
    createdBy: string | null;
}

export interface InitialServerState {
    serverId: string | null;
    serverName: string | null;
}

