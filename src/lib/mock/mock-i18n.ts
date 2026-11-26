/**
 * DEV-ONLY i18n keyword fixtures (Thai) for the mock layer.
 *
 * Served for GET /public/keywords/{tag} so sidebar labels ($i18nKW) and the
 * <ssk-i18n-translate> web components (populated via IdbI18nStore.bulkSet)
 * render real Thai instead of raw keyword strings — makes visual review easy.
 *
 * Covers the reviewed screens: sidebar, my-order list, customer-book list +
 * common buttons/labels. Keys not listed here fall back to the raw key
 * (current behaviour) — extend as more screens are reviewed.
 *
 * Shape matches TagListKeywordResponse: { [key]: { [lang]: string } }.
 * `default` mirrors `th` so components using fallbackLang="default" resolve too.
 */
const t = (th: string, en: string): { th: string; en: string; default: string } => ({
	th,
	en,
	default: th
});

export const KEYWORDS: Record<string, Record<string, string>> = {
	/* ---------------------------------------------------------- sidebar */
	'patona-sellercenter-sidebar-title-main': t('หน้าหลัก', 'Main'),
	'patona-sellercenter-sidebar-title-product': t('สินค้า', 'Product'),
	'patona-sellercenter-sidebar-title-ordermanagement': t('การจัดการคำสั่งซื้อ', 'Order management'),
	'patona-sellercenter-sidebar-title-fulfillment': t('การจัดส่ง', 'Fulfillment'),
	'patona-sellercenter-sidebar-title-customer-management': t(
		'การจัดการลูกค้า',
		'Customer management'
	),
	'patona-sellercenter-sidebar-menu-home': t('หน้าหลัก', 'Home'),
	'patona-sellercenter-sidebar-menu-myproduct': t('สินค้าของฉัน', 'My products'),
	'patona-sellercenter-sidebar-menu-addproduct': t('เพิ่มสินค้า', 'Add product'),
	'patona-sellercenter-sidebar-menu-sales': t('ขายสินค้า', 'Sell'),
	'patona-sellercenter-sidebar-menu-myorder': t('คำสั่งซื้อ', 'Orders'),
	'patona-sellercenter-sidebar-menu-quicklabel': t('พิมพ์ใบปะหน้า', 'Quick label'),
	'patona-sellercenter-sidebar-menu-parcelmanagement': t('จัดการพัสดุ', 'Parcels'),
	'patona-sellercenter-sidebar-menu-customerbook': t('สมุดลูกค้า', 'Customer book'),
	'patona-sellercenter-sidebar-menu-setting': t('ตั้งค่า', 'Settings'),
	'patona-sellercenter-sidebar-menu-support': t('ติดต่อเรา', 'Contact us'),
	'patona-sellercenter-sidebar-radio-addnewstore': t('เพิ่มร้านค้าใหม่', 'Add new store'),

	/* --------------------------------------------------------- my order */
	'patona-sellercenter-myorder-title-myorder': t('คำสั่งซื้อของฉัน', 'My orders'),
	'patona-sellercenter-myorder-subtitle-ordersfound': t('รายการคำสั่งซื้อ', 'orders found'),
	'patona-sellercenter-myorder-tab-all': t('ทั้งหมด', 'All'),
	'patona-sellercenter-myorder-tab-inprogress': t('กำลังดำเนินการ', 'In progress'),
	'patona-sellercenter-myorder-tab-completed': t('สำเร็จ', 'Completed'),
	'patona-sellercenter-myorder-tab-canceled': t('ยกเลิก', 'Canceled'),

	/* ------------------------------------------- OMS 2.0 order list (DES-2235) */
	'oms.order.tab.refund': t('คืนเงิน', 'Refund'),
	'oms.order.banner.unknown': t(
		'มีคำสั่งซื้อที่ระบบไม่ทราบสถานะ ติดต่อทีมงานผ่านเมนูติดต่อเรา พร้อมเลขคำสั่งซื้อ',
		'Some orders have an unknown status. Contact us via the Contact menu with the order number.'
	),
	'oms.order.status.created': t('สร้างแล้ว', 'Created'),
	'oms.order.status.confirmed': t('ยืนยันแล้ว', 'Confirmed'),
	'oms.order.status.preparing': t('กำลังเตรียมสินค้า', 'Preparing'),
	'oms.order.status.ready_to_deliver': t('พร้อมส่งมอบ', 'Ready to deliver'),
	'oms.order.status.delivering': t('กำลังจัดส่ง', 'Delivering'),
	'oms.order.status.delivered': t('ส่งมอบแล้ว', 'Delivered'),
	'oms.order.status.completed': t('สำเร็จ', 'Completed'),
	'oms.order.status.cancelled': t('ยกเลิก', 'Cancelled'),
	'oms.order.status.reversed': t('ย้อนรายการ', 'Reversed'), // PO Q1: not "คืนสินค้า" (services reverse too)
	'oms.order.status.refunded': t('คืนเงินแล้ว', 'Refunded'),
	'oms.order.status.unknown': t('ไม่ทราบสถานะ', 'Unknown'),
	'oms.order.payment.unpaid': t('รอชำระเงิน', 'Unpaid'),
	'oms.order.payment.pending_review': t('รอตรวจสอบสลิป', 'Pending review'),
	'oms.order.payment.partially_paid': t('ชำระบางส่วน', 'Partially paid'),
	'oms.order.payment.paid': t('ชำระแล้ว', 'Paid'),
	'oms.order.payment.cod_pending': t('รอเก็บเงินปลายทาง', 'COD pending'),
	'oms.order.payment.overpaid': t('ชำระเกิน', 'Overpaid'),
	'oms.order.payment.refunding': t('กำลังคืนเงิน', 'Refunding'),
	'oms.order.payment.refunded': t('คืนเงินแล้ว', 'Refunded'),
	'oms.order.payment.voided': t('ยกเลิกการชำระ', 'Payment cancelled'), // PO Q8: one word for void + cancelled
	'oms.order.action.view': t('ดูรายละเอียด', 'View'),
	'oms.order.action.record_payment': t('บันทึกการชำระ', 'Record payment'),
	'oms.order.action.record_cod': t('บันทึกยอด COD', 'Record COD'),
	'oms.order.header.fulfillment': t('วิธีรับสินค้า', 'Fulfillment'),
	'oms.order.header.stock': t('สต็อก', 'Stock'),
	// Same wording as the sale page (Cart.svelte fullfilmentMeta / groupKindLabel).
	'oms.order.fulfillment.pickup_now': t('รับทันที', 'Pick up now'),
	'oms.order.fulfillment.pickup_later': t('รับภายหลัง', 'Pick up later'),
	'oms.order.fulfillment.shipping': t('จัดส่งจากร้าน', 'Ship from store'),
	'oms.order.fulfillment.digital': t('จัดส่งเข้าระบบ (ดิจิทัล)', 'Digital delivery'),
	'oms.order.fulfillment.service': t('ให้บริการ', 'Service'),
	'oms.order.fulfillment.multi': t('หลายวิธี', 'Multiple methods'),
	'oms.order.fulfillment.groups': t('จัดส่งตามที่อยู่', 'Ship by address'),
	'oms.order.fulfillment.groups_unit': t('กลุ่ม', 'groups'),
	'oms.order.stock.reserved': t('จองครบ', 'Reserved'),
	'oms.order.stock.partial': t('ยังไม่ครบ', 'Partially reserved'),
	'oms.order.stock.deducted': t('ตัดสต็อกแล้ว', 'Deducted'),
	'oms.order.payment_method.cash': t('เงินสด', 'Cash'),
	'oms.order.payment_method.transfer': t('โอนเงิน', 'Bank transfer'),
	'oms.order.payment_method.card': t('บัตร', 'Card'),
	// Same 3 channel names as the sale page channel switcher.
	// Per-group task steps (PO Q10) — named by job type, e.g. service says "กำลังให้บริการ".
	'oms.order.step.queued': t('รอดำเนินการ', 'Queued'),
	'oms.order.step.pickup_at_store': t('ยื่นของให้ลูกค้าแล้ว', 'Handed over'),
	'oms.order.step.preparing': t('กำลังเตรียมของ', 'Preparing'),
	'oms.order.step.ready_for_pickup': t('พร้อมให้ลูกค้ารับ', 'Ready for pickup'),
	'oms.order.step.pickedup_at_store': t('ลูกค้ารับแล้ว', 'Picked up'),
	'oms.order.step.packed': t('แพ็กแล้ว', 'Packed'),
	'oms.order.step.shipped': t('กำลังขนส่ง', 'In transit'),
	'oms.order.step.delivered': t('ส่งมอบแล้ว', 'Delivered'),
	'oms.order.step.issuing': t('กำลังออกสิทธิ์', 'Issuing'),
	'oms.order.step.revoked': t('เพิกถอนสิทธิ์แล้ว', 'Revoked'),
	'oms.order.step.scheduled': t('นัดหมายแล้ว', 'Scheduled'),
	'oms.order.step.in_progress': t('กำลังให้บริการ', 'In service'),
	'oms.order.step.done': t('ให้บริการเสร็จ', 'Service done'),
	'oms.order.step.no_show': t('ลูกค้าไม่มาตามนัด', 'No-show'),
	'oms.order.step.service_interrupted': t('บริการถูกขัดจังหวะ', 'Interrupted'),
	'oms.order.step.returning': t('กำลังส่งคืน', 'Returning'),
	'oms.order.step.returned': t('คืนแล้ว', 'Returned'),
	'oms.order.step.reversed': t('ย้อนรายการ', 'Reversed'),
	'oms.order.step.cancelled': t('ยกเลิก', 'Cancelled'),
	// "งานที่ต้องทำต่อ" filter (PO Q16)
	'oms.order.filter.next_action': t('งานที่ต้องทำต่อ', 'Next action'),
	'oms.order.next_action.awaiting_payment': t('รอชำระเงิน', 'Awaiting payment'),
	'oms.order.next_action.awaiting_delivery': t('รอส่งมอบ', 'Awaiting delivery'),
	'oms.order.next_action.awaiting_cod': t('รอรับเงิน COD', 'Awaiting COD'),
	'oms.order.next_action.awaiting_stock': t('รอสต็อก', 'Awaiting stock'),
	'oms.order.next_action.needs_attention': t('ต้องตรวจดู', 'Needs attention'),
	'oms.order.filter.channel_group.store': t('POS', 'POS'),
	'oms.order.filter.channel_group.online': t('ออนไลน์', 'Online'),
	'oms.order.filter.channel_group.link': t('ลิงก์', 'Link'),
	'oms.order.state.error_title': t('โหลดรายการคำสั่งซื้อไม่สำเร็จ', 'Couldn’t load orders'),
	'oms.order.state.error_desc': t(
		'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
		'Something went wrong. Please try again.'
	),
	'oms.order.state.retry': t('ลองใหม่', 'Try again'),
	'oms.order.state.no_match_title': t('ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไข', 'No matching orders'),
	'oms.order.state.no_match_desc': t(
		'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง',
		'Try a different search or clear the filters.'
	),
	'patona-sellercenter-myorder-placeholder-search': t(
		'ค้นหาเลขคำสั่งซื้อ หรือ ชื่อลูกค้า',
		'Search order no. or customer'
	),
	'patona-sellercenter-myorder-placeholder-startdate': t('วันที่เริ่มต้น', 'Start date'),
	'patona-sellercenter-myorder-placeholder-enddate': t('วันที่สิ้นสุด', 'End date'),
	'patona-sellercenter-myorder-button-filter': t('ตัวกรอง', 'Filter'),
	'patona-sellercenter-myorder-button-apply': t('ยืนยัน', 'Apply'),
	'patona-sellercenter-myorder-button-clearall': t('ล้างทั้งหมด', 'Clear all'),
	'patona-sellercenter-myorder-title-daterange': t('ช่วงวันที่', 'Date range'),
	'patona-sellercenter-myorder-title-paymentmethod': t('วิธีการชำระเงิน', 'Payment method'),
	'patona-sellercenter-myorder-title-paymentstatus': t('สถานะการชำระเงิน', 'Payment status'),
	'patona-sellercenter-myorder-table-header-salesorder': t('เลขคำสั่งซื้อ', 'Order no.'),
	'patona-sellercenter-myorder-table-header-customername': t('ชื่อลูกค้า', 'Customer'),
	'patona-sellercenter-myorder-table-header-saleschannel': t('ช่องทางการขาย', 'Sales channel'),
	'patona-sellercenter-myorder-table-header-totalamount': t('ยอดรวม', 'Total'),
	'patona-sellercenter-myorder-table-header-paymentstatus': t('สถานะการชำระเงิน', 'Payment status'),
	'patona-sellercenter-myorder-table-header-orderstatus': t('สถานะคำสั่งซื้อ', 'Order status'),
	'patona-sellercenter-myorder-table-header-createddate': t('วันที่สร้าง', 'Created date'),
	'patona-sellercenter-myorder-table-body-cash': t('เงินสด', 'Cash'),
	'patona-sellercenter-myorder-table-body-bank': t('โอนเงิน', 'Bank transfer'),
	'patona-sellercenter-myorder-table-body-credit': t('บัตรเครดิต', 'Credit card'),
	'patona-sellercenter-myorder-table-body-debit': t('บัตรเดบิต', 'Debit card'),
	'patona-sellercenter-myorder-table-body-other': t('อื่นๆ', 'Other'),
	'patona-sellercenter-myorder-table-body-unspecified': t('ไม่ระบุ', 'Unspecified'),
	'patona-sellercenter-myorder-checkbox-cash': t('เงินสด', 'Cash'),
	'patona-sellercenter-myorder-checkbox-banktransfer': t('โอนเงิน', 'Bank transfer'),
	'patona-sellercenter-myorder-checkbox-card': t('บัตร', 'Card'),
	'patona-sellercenter-myorder-checkbox-cod': t('เก็บเงินปลายทาง', 'COD'),
	'patona-sellercenter-myorder-checkbox-other': t('อื่นๆ', 'Other'),
	'patona-sellercenter-myorder-checkbox-paid': t('ชำระแล้ว', 'Paid'),
	'patona-sellercenter-myorder-checkbox-waitingpayment': t('รอชำระเงิน', 'Waiting for payment'),
	'patona-sellercenter-myorder-checkbox-unknown': t('ไม่ทราบสถานะ', 'Unknown'),

	/* ------------------------------------------------------ customer book */
	'patona-sellercenter-customerbook-title-customerbook': t('สมุดลูกค้า', 'Customer book'),
	'patona-sellercenter-customerbook-button-addcustomer': t('เพิ่มลูกค้า', 'Add customer'),
	'patona-sellercenter-customerbook-placeholder-search': t(
		'ค้นหาชื่อ หรือ เบอร์โทรลูกค้า',
		'Search name or phone'
	),
	'patona-sellercenter-customerbook-table-header-customername': t('ชื่อลูกค้า', 'Customer'),
	'patona-sellercenter-customerbook-table-header-phone': t('เบอร์โทรศัพท์', 'Phone'),
	'patona-sellercenter-customerbook-table-header-totalorder': t('จำนวนคำสั่งซื้อ', 'Total orders'),
	'patona-sellercenter-customerbook-table-header-latestorder': t('สั่งซื้อล่าสุด', 'Latest order'),
	'patona-sellercenter-customerbook-table-blank-nocustomer': t(
		'ยังไม่มีลูกค้า',
		'No customers yet'
	),
	'patona-sellercenter-customerbook-table-body-menu-view': t('ดูข้อมูล', 'View'),
	'patona-sellercenter-customerbook-table-body-menu-edit': t('แก้ไข', 'Edit'),
	'patona-sellercenter-customerbook-table-body-menu-editdata': t('แก้ไขข้อมูล', 'Edit data'),
	'patona-sellercenter-customerbook-table-body-menu-delete': t('ลบ', 'Delete'),
	'patona-sellercenter-customerbook-add-title-addcustomer': t('เพิ่มลูกค้า', 'Add customer'),
	'patona-sellercenter-customerbook-add-title-information': t(
		'ข้อมูลลูกค้า',
		'Customer information'
	),
	'patona-sellercenter-customerbook-edit-title-editcustomer': t(
		'แก้ไขข้อมูลลูกค้า',
		'Edit customer'
	),
	'patona-sellercenter-customerbook-button-cancel': t('ยกเลิก', 'Cancel'),
	'patona-sellercenter-customerbook-button-save': t('บันทึก', 'Save'),
	'patona-sellercenter-customerbook-button-delete': t('ลบ', 'Delete'),
	'patona-sellercenter-customerbook-button-addshippingaddress': t(
		'เพิ่มที่อยู่จัดส่ง',
		'Add shipping address'
	),
	'patona-sellercenter-customerbook-button-addtaxaddress': t(
		'เพิ่มที่อยู่ใบกำกับภาษี',
		'Add tax address'
	),
	'patona-sellercenter-customerbook-detail-badge-customerdetail': t(
		'ข้อมูลลูกค้า',
		'Customer detail'
	),
	'patona-sellercenter-customerbook-detail-customersince': t('เป็นลูกค้าตั้งแต่', 'Customer since'),
	'patona-sellercenter-customerbook-detail-tab-saleshistory': t(
		'ประวัติการสั่งซื้อ',
		'Sales history'
	),
	'patona-sellercenter-customerbook-detail-tab-shippingaddress': t(
		'ที่อยู่จัดส่ง',
		'Shipping address'
	),
	'patona-sellercenter-customerbook-detail-tab-taxaddress': t('ที่อยู่ใบกำกับภาษี', 'Tax address'),
	'patona-sellercenter-customerbook-shippingaddress': t('ที่อยู่จัดส่ง', 'Shipping address'),
	'patona-sellercenter-customerbook-taxaddress': t('ที่อยู่ใบกำกับภาษี', 'Tax address'),
	'patona-sellercenter-customerbook-noshippingaddress': t(
		'ยังไม่มีที่อยู่จัดส่ง',
		'No shipping address'
	),
	'patona-sellercenter-customerbook-notaxaddress': t(
		'ยังไม่มีที่อยู่ใบกำกับภาษี',
		'No tax address'
	),
	'patona-sellercenter-customerbook-shippingaddress-table-header-fullname': t(
		'ชื่อ-นามสกุล',
		'Full name'
	),
	'patona-sellercenter-customerbook-shippingaddress-table-header-phone': t(
		'เบอร์โทรศัพท์',
		'Phone'
	),
	'patona-sellercenter-customerbook-shippingaddress-table-header-address': t('ที่อยู่', 'Address'),
	'patona-sellercenter-customerbook-shippingaddress-table-header-primaryaddress': t(
		'ที่อยู่หลัก',
		'Primary address'
	),
	'patona-sellercenter-customerbook-taxaddress-table-header-name': t('ชื่อ', 'Name'),
	'patona-sellercenter-customerbook-taxaddress-table-header-taxid': t(
		'เลขประจำตัวผู้เสียภาษี',
		'Tax ID'
	),
	'patona-sellercenter-customerbook-taxaddress-table-header-address': t('ที่อยู่', 'Address'),
	'patona-sellercenter-customerbook-taxaddress-table-header-email': t('อีเมล', 'Email'),
	'patona-sellercenter-customerbook-taxaddress-table-header-type': t('ประเภท', 'Type'),
	'patona-sellercenter-customerbook-modal-shipping-title-addshipping': t(
		'เพิ่มที่อยู่จัดส่ง',
		'Add shipping address'
	),
	'patona-sellercenter-customerbook-modal-shipping-title-editshipping': t(
		'แก้ไขที่อยู่จัดส่ง',
		'Edit shipping address'
	),
	'patona-sellercenter-customerbook-modal-shipping-label-fullname': t('ชื่อ-นามสกุล', 'Full name'),
	'patona-sellercenter-customerbook-modal-shipping-label-phone': t('เบอร์โทรศัพท์', 'Phone'),
	'patona-sellercenter-customerbook-modal-shipping-placeholder-fullname': t(
		'กรอกชื่อ-นามสกุล',
		'Enter full name'
	),
	'patona-sellercenter-customerbook-modal-shipping-placeholder-phone': t(
		'กรอกเบอร์โทรศัพท์',
		'Enter phone'
	),
	'patona-sellercenter-customerbook-modal-tax-title-addtax': t(
		'เพิ่มที่อยู่ใบกำกับภาษี',
		'Add tax address'
	),
	'patona-sellercenter-customerbook-modal-tax-title-edittax': t(
		'แก้ไขที่อยู่ใบกำกับภาษี',
		'Edit tax address'
	),
	'patona-sellercenter-customerbook-modal-taxinvoice-label-fullname': t(
		'ชื่อ-นามสกุล',
		'Full name'
	),
	'patona-sellercenter-customerbook-modal-taxinvoice-label-companyname': t(
		'ชื่อบริษัท',
		'Company name'
	),
	'patona-sellercenter-customerbook-modal-taxinvoice-label-taxid': t(
		'เลขประจำตัวผู้เสียภาษี',
		'Tax ID'
	),
	'patona-sellercenter-customerbook-modal-taxinvoice-label-branchcode': t(
		'รหัสสาขา',
		'Branch code'
	),
	'patona-sellercenter-customerbook-modal-taxinvoice-label-phone': t('เบอร์โทรศัพท์', 'Phone'),
	'patona-sellercenter-customerbook-modal-taxinvoice-label-email': t('อีเมล', 'Email'),
	'patona-sellercenter-customerbook-modal-taxinvoice-radio-individual': t(
		'บุคคลธรรมดา',
		'Individual'
	),
	'patona-sellercenter-customerbook-modal-taxinvoice-radio-corporateentity': t(
		'นิติบุคคล',
		'Corporate entity'
	),

	/* ------------------------------------------------ status badges (order) */
	'patona-sellercenter-badge-orderstatus-inprogress': t('กำลังดำเนินการ', 'In progress'),
	'patona-sellercenter-badge-orderstatus-complete': t('สำเร็จ', 'Completed'),
	'patona-sellercenter-badge-orderstatus-canceled': t('ยกเลิก', 'Canceled'),
	'patona-sellercenter-badge-orderstatus-refunding': t('กำลังคืนเงิน', 'Refunding'),
	'patona-sellercenter-badge-paymentstatus-paid': t('ชำระแล้ว', 'Paid'),
	'patona-sellercenter-badge-paymentstatus-refunded': t('คืนเงินแล้ว', 'Refunded'),
	'patona-sellercenter-badge-paymentstatus-waitingforpayment': t(
		'รอชำระเงิน',
		'Waiting for payment'
	),

	/* ------------------------------------------- POS: fulfilment (sales cart) */
	'order.delivery.pickup_immediate': t('รับทันที', 'Pick up now'),
	'order.delivery.pickup_later': t('รับภายหลัง', 'Pick up later'),
	'order.delivery.shop_delivery': t('จัดส่งจากหน้าร้าน', 'Delivery from store'),

	/* ------------------------------------------------ POS: sales cart + modals */
	'patona-sellercenter-sales-placeholder-search': t('ค้นหาสินค้า', 'Search products'),
	'patona-sellercenter-sales-tab-all': t('ทั้งหมด', 'All'),
	'patona-sellercenter-sales-tab-pysical': t('สินค้าทั่วไป', 'Physical'),
	'patona-sellercenter-sales-tab-services': t('บริการ', 'Services'),
	'patona-sellercenter-sales-tab-digital': t('สินค้าดิจิทัล', 'Digital'),
	'patona-sellercenter-sales-subtitle-productsfound': t('สินค้าที่พบ', 'Products found'),
	'patona-sellercenter-sales-title-cartfound': t('ตะกร้าสินค้า', 'Cart'),
	'patona-sellercenter-sales-subtitle-totalitems': t('สินค้าทั้งหมด', 'All items'),
	'patona-sellercenter-sales-classifier-menu': t('รายการ', 'items'),
	'patona-sellercenter-sales-title-discount': t('ส่วนลด', 'Discount'),
	'patona-sellercenter-sales-tooltip': t(
		'ส่วนลดคำนวณจากยอดรวมทั้งบิล',
		'Discount applies to the bill total'
	),
	'patona-sellercenter-sales-option-percentage': t('เปอร์เซ็นต์', 'Percentage'),
	'patona-sellercenter-sales-option-fixed': t('บาท', 'Baht'),
	'patona-sellercenter-sales-placeholder-percentage': t('ระบุเปอร์เซ็นต์', 'Enter percentage'),
	'patona-sellercenter-sales-placeholder-fixed': t('ระบุจำนวนเงิน', 'Enter amount'),
	'patona-sellercenter-sales-summary-totalprice': t('ราคารวม', 'Subtotal'),
	'patona-sellercenter-sales-summary-discount': t('ส่วนลด', 'Discount'),
	'patona-sellercenter-sales-summary-shippingfee': t('ค่าจัดส่ง', 'Shipping fee'),
	'patona-sellercenter-sales-summary-grandtotal': t('สรุปยอด', 'Total'),
	'patona-sellercenter-sales-button-clearcart': t('ล้างตะกร้า', 'Clear cart'),
	'patona-sellercenter-sales-button-checkout': t('ชำระเงิน', 'Checkout'),
	'patona-sellercenter-sales-title-order': t('คำสั่งขาย', 'Sale order'),
	'patona-sellercenter-sales-modal-add-title-additem': t('เพิ่มสินค้า', 'Add item'),
	'patona-sellercenter-sales-modal-add-subtitle-reviewitems': t('ตรวจสอบรายการ', 'Review item'),
	'patona-sellercenter-sales-modal-add-button-addcart': t('เพิ่มลงตะกร้า', 'Add to cart'),
	'patona-sellercenter-sales-modal-add-button-cancel': t('ยกเลิก', 'Cancel'),
	'patona-sellercenter-sales-modal-edit-title-edititem': t('แก้ไขสินค้า', 'Edit item'),
	'patona-sellercenter-sales-modal-edit-subtitle-reviewitems': t('ตรวจสอบรายการ', 'Review item'),
	'patona-sellercenter-sales-modal-edit-button-updateitem': t('บันทึกการแก้ไข', 'Update item'),
	'patona-sellercenter-sales-modal-edit-button-cancel': t('ยกเลิก', 'Cancel'),
	'patona-sellercenter-sales-modal-remove-title-remove': t('ลบสินค้าออกจากตะกร้า', 'Remove item'),
	'patona-sellercenter-sales-modal-remove-button-remove': t('ลบสินค้า', 'Remove'),
	'patona-sellercenter-sales-modal-remove-button-cancel': t('ยกเลิก', 'Cancel'),
	'patona-sellercenter-sales-modal-clear-title-clearcart': t('ล้างตะกร้าสินค้า', 'Clear cart'),
	'patona-sellercenter-sales-modal-clear-description-clearcart': t(
		'สินค้าทั้งหมดในตะกร้าจะถูกลบออก',
		'All items in the cart will be removed'
	),
	'patona-sellercenter-sales-modal-clear-button-clearcart': t('ล้างตะกร้า', 'Clear cart'),
	'patona-sellercenter-sales-modal-clear-button-close': t('ปิด', 'Close'),
	'patona-sellercenter-sales-modal-payment-title-order': t('ชำระเงิน', 'Payment'),
	'patona-sellercenter-sales-modal-payment-button-confirm': t(
		'ยืนยันการชำระเงิน',
		'Confirm payment'
	),
	'patona-sellercenter-sales-modal-payment-button-back': t('กลับ', 'Back'),
	'patona-sellercenter-sales-modal-success-title-paymentsuccessful': t(
		'ชำระเงินสำเร็จ',
		'Payment successful'
	),
	'patona-sellercenter-sales-modal-success-button-printreceipt': t('พิมพ์ใบเสร็จ', 'Print receipt'),
	'patona-sellercenter-sales-modal-success-button-back': t('กลับหน้าขายสินค้า', 'Back to sales'),

	/* ------------------------------------------------------------- common */
	'patona-sellercenter-company-button-next': t('ถัดไป', 'Next'),
	'patona-sellercenter-company-button-back': t('ย้อนกลับ', 'Back'),
	'patona-sellercenter-company-button-cancel': t('ยกเลิก', 'Cancel')
};

export const LANGUAGES = [
	{ language_code: 'th', country_name: 'ไทย', image_base64: '' },
	{ language_code: 'en', country_name: 'English', image_base64: '' }
];
