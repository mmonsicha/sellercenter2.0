export enum EntityPermission {
	CUSTOMERCREATE = 'patona.customer.create',
	CUSTOMERVIEW = 'patona.customer.view',
	CUSTOMERUPDATE = 'patona.customer.update',
	ORDERCREATE = 'patona.order.create',
	ORDERVIEW = 'patona.order.view',
	ORDERUPDATE = 'patona.order.update',
	ORDERSTATUSUPDATE = 'patona.order.status.update',
	SELLSUKISTOREUPDATE = 'sellsuki.company.stores.update',
	STORECREATE = 'patona.store.create',
	STOREUPDATE = 'patona.store.update',
	STOREORDEREXPIRYEDIT = 'patona.store.order.expiry.edit',
	ORDERPAYMENTMANAGE = 'patona.order.payment.manage',
	// OMS 2.0 (DES-2235). Not yet issued by the IAM service — the list page accepts
	// either this or ORDERVIEW until roles are migrated.
	OMSORDERVIEW = 'oms.order.view'
}
